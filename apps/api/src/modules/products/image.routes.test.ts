import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import { afterEach, test } from "node:test";
import {
  createProductImageRouter,
  createPublicProductImageRouter,
  type ProductImageRepository,
} from "./image.routes.js";
import {
  createProductImageStorage,
  MAX_PRODUCT_IMAGE_SIZE,
  productImageDirectory,
  type ProductImageStorage,
} from "./image-storage.js";

const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
]);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rYsAAAAASUVORK5CYII=",
  "base64",
);
const webp = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==",
  "base64",
);

const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolveClose, reject) => {
          server.close((error) => (error ? reject(error) : resolveClose()));
        }),
    ),
  );
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "freshmart-images-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function startTestServer(
  directory: string,
  repository: ProductImageRepository,
  storageOverride?: ProductImageStorage,
): Promise<string> {
  const app = express();
  const storage = storageOverride ?? createProductImageStorage(directory);
  app.use(
    "/api/admin/products",
    createProductImageRouter({ repository, storage }),
  );
  app.use("/uploads/products", createPublicProductImageRouter(storage));
  app.use(
    (
      _error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      response.status(500).json({ error: "Internal server error." });
    },
  );
  const server = createServer(app);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

function fakeRepository(options?: {
  imageUrl?: string | null;
  updateError?: Error;
}): ProductImageRepository & {
  updates: Array<{ productId: string; imageUrl: string }>;
} {
  const updates: Array<{ productId: string; imageUrl: string }> = [];
  return {
    updates,
    async findActiveImage() {
      return { imageUrl: options?.imageUrl ?? null };
    },
    async updateActiveImage(productId, imageUrl) {
      updates.push({ productId, imageUrl });
      if (options?.updateError) throw options.updateError;
      return true;
    },
  };
}

async function postImage(
  baseUrl: string,
  productId: string,
  bytes: Buffer,
  contentType = "application/octet-stream",
  filename = "untrusted.bin",
): Promise<Response> {
  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    filename,
  );
  return fetch(`${baseUrl}/api/admin/products/${productId}/image`, {
    method: "POST",
    body: form,
  });
}

test("accepts JPEG, PNG, and WebP based on bytes and persists generated files", async () => {
  const directory = await temporaryDirectory();
  const repository = fakeRepository();
  const baseUrl = await startTestServer(directory, repository);

  for (const [bytes, extension] of [
    [jpeg, "jpg"],
    [png, "png"],
    [webp, "webp"],
  ] as const) {
    const response = await postImage(
      baseUrl,
      "42",
      bytes,
      "text/plain",
      "../fake.txt",
    );
    assert.equal(response.status, 200, await response.clone().text());
    const body = (await response.json()) as { imageUrl: string };
    const match =
      /^\/uploads\/products\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|webp)$/.exec(
        body.imageUrl,
      );
    assert(match);
    assert.equal(match[2], extension);
    assert.equal(repository.updates.at(-1)?.productId, "42");
    assert.equal(repository.updates.at(-1)?.imageUrl, body.imageUrl);
    assert.deepEqual(
      await readFile(join(directory, `${match[1]}.${extension}`)),
      bytes,
    );

    const publicResponse = await fetch(`${baseUrl}${body.imageUrl}`);
    assert.equal(publicResponse.status, 200);
    assert.deepEqual(Buffer.from(await publicResponse.arrayBuffer()), bytes);
  }

  assert.equal(
    (await fetch(`${baseUrl}/uploads/products/not-an-image.jpg`)).status,
    404,
  );
  assert.equal(
    (await fetch(`${baseUrl}/uploads/products/%2e%2e%2fsecret.jpg`)).status,
    404,
  );
});

test("rejects unsupported or MIME-spoofed bytes without writing or updating", async () => {
  const directory = await temporaryDirectory();
  const oldFilename = "33333333-3333-4333-8333-333333333333.jpg";
  const oldUrl = `/uploads/products/${oldFilename}`;
  await writeFile(join(directory, oldFilename), jpeg);
  const repository = fakeRepository({ imageUrl: oldUrl });
  const baseUrl = await startTestServer(directory, repository);
  const response = await postImage(
    baseUrl,
    "7",
    Buffer.from("this is not an image"),
    "image/jpeg",
    "real.jpg",
  );

  assert.equal(response.status, 400);
  assert.equal(repository.updates.length, 0);
  assert.deepEqual(await readFile(join(directory, oldFilename)), jpeg);
  assert.deepEqual(await readdir(directory), [oldFilename]);
});

test("malformed multipart uploads return a client error", async () => {
  const directory = await temporaryDirectory();
  const repository = fakeRepository();
  const baseUrl = await startTestServer(directory, repository);
  const form = new FormData();
  form.append("unexpected", new Blob([new Uint8Array(jpeg)]), "image.jpg");
  const response = await fetch(`${baseUrl}/api/admin/products/12/image`, {
    method: "POST",
    body: form,
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await readdir(directory), []);
  assert.equal(repository.updates.length, 0);
});

test("accepts exactly 5 MiB and rejects larger files", async () => {
  const directory = await temporaryDirectory();
  const repository = fakeRepository();
  const baseUrl = await startTestServer(directory, repository);
  const atLimit = Buffer.alloc(MAX_PRODUCT_IMAGE_SIZE);
  png.copy(atLimit);
  const accepted = await postImage(baseUrl, "9", atLimit);
  assert.equal(accepted.status, 200);

  const oversized = Buffer.alloc(MAX_PRODUCT_IMAGE_SIZE + 1);
  png.copy(oversized);
  const rejected = await postImage(baseUrl, "9", oversized);
  assert.equal(rejected.status, 413);
  assert.equal(repository.updates.length, 1);
  assert.equal((await readdir(directory)).length, 1);
});

test("replacement removes only the prior managed file after the database update", async () => {
  const directory = await temporaryDirectory();
  const oldFilename = "11111111-1111-4111-8111-111111111111.jpg";
  const oldUrl = `/uploads/products/${oldFilename}`;
  await writeFile(join(directory, oldFilename), jpeg);
  const repository = fakeRepository({ imageUrl: oldUrl });
  const baseUrl = await startTestServer(directory, repository);

  const response = await postImage(baseUrl, "19", png);
  assert.equal(response.status, 200);
  assert.equal(repository.updates[0]?.productId, "19");
  await assert.rejects(readFile(join(directory, oldFilename)), {
    code: "ENOENT",
  });
  const body = (await response.json()) as { imageUrl: string };
  assert.equal(
    (await readFile(join(directory, body.imageUrl.split("/").at(-1)!))).length,
    png.length,
  );
});

test("storage failure returns a server error and preserves the previous image", async () => {
  const directory = await temporaryDirectory();
  const oldFilename = "44444444-4444-4444-8444-444444444444.png";
  const oldUrl = `/uploads/products/${oldFilename}`;
  await writeFile(join(directory, oldFilename), png);
  const repository = fakeRepository({ imageUrl: oldUrl });
  const storage: ProductImageStorage = {
    ...createProductImageStorage(directory),
    async save() {
      throw new Error("disk unavailable");
    },
  };
  const baseUrl = await startTestServer(directory, repository, storage);

  const response = await postImage(baseUrl, "21", jpeg);
  assert.equal(response.status, 500);
  assert.equal(repository.updates.length, 0);
  assert.deepEqual(await readFile(join(directory, oldFilename)), png);
  assert.deepEqual(await readdir(directory), [oldFilename]);
});

test("database update failure removes the new file and preserves the old file", async () => {
  const directory = await temporaryDirectory();
  const oldFilename = "22222222-2222-4222-8222-222222222222.webp";
  const oldUrl = `/uploads/products/${oldFilename}`;
  await writeFile(join(directory, oldFilename), webp);
  const repository = fakeRepository({
    imageUrl: oldUrl,
    updateError: new Error("database failed"),
  });
  const baseUrl = await startTestServer(directory, repository);

  const response = await postImage(baseUrl, "20", jpeg);
  assert.equal(response.status, 500);
  assert.deepEqual(await readFile(join(directory, oldFilename)), webp);
  assert.deepEqual(await readdir(directory), [oldFilename]);
});

test("missing active products and invalid IDs do not write files", async () => {
  const directory = await temporaryDirectory();
  const repository: ProductImageRepository = {
    async findActiveImage() {
      return null;
    },
    async updateActiveImage() {
      return false;
    },
  };
  const baseUrl = await startTestServer(directory, repository);

  assert.equal((await postImage(baseUrl, "not-a-number", jpeg)).status, 400);
  assert.equal((await postImage(baseUrl, "404", jpeg)).status, 404);
  assert.deepEqual(await readdir(directory), []);
});

test("a recreated storage service reads existing uploads and src/dist paths converge", async () => {
  const directory = await temporaryDirectory();
  const firstService = createProductImageStorage(directory);
  const saved = await firstService.save(webp);
  const recreatedService = createProductImageStorage(directory);
  assert.deepEqual(await recreatedService.read(saved.filename), webp);

  const simulatedApiRoot = resolve(directory, "api");
  const sourceModule = pathToFileURL(
    join(simulatedApiRoot, "src", "modules", "products", "image-storage.js"),
  ).href;
  const builtModule = pathToFileURL(
    join(simulatedApiRoot, "dist", "modules", "products", "image-storage.js"),
  ).href;
  assert.equal(
    productImageDirectory(sourceModule),
    productImageDirectory(builtModule),
  );
  assert.equal(
    productImageDirectory(builtModule),
    join(simulatedApiRoot, "uploads", "products"),
  );
});
