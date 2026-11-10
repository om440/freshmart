import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fileTypeFromBuffer } from "file-type";

export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

export class ProductImageValidationError extends Error {}

const SUPPORTED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ProductImageExtension =
  (typeof SUPPORTED_IMAGE_TYPES)[keyof typeof SUPPORTED_IMAGE_TYPES];

export interface StoredProductImage {
  imageUrl: string;
  filename: string;
  filePath: string;
}

export interface ProductImageStorage {
  directory: string;
  save(buffer: Buffer): Promise<StoredProductImage>;
  remove(imageUrl: string | null): Promise<void>;
  resolvePublicFile(filename: string): string | null;
  read(filename: string): Promise<Buffer | null>;
}

export function productImageDirectory(moduleUrl = import.meta.url): string {
  return resolve(
    dirname(fileURLToPath(moduleUrl)),
    "../../../uploads/products",
  );
}

export function createProductImageStorage(
  directory = productImageDirectory(),
): ProductImageStorage {
  const root = resolve(directory);

  function managedPath(filename: string): string | null {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(
        filename,
      )
    ) {
      return null;
    }
    return join(root, filename);
  }

  return {
    directory: root,
    async save(buffer) {
      if (buffer.length > MAX_PRODUCT_IMAGE_SIZE) {
        throw new ProductImageValidationError(
          "Image must be 5 MiB or smaller.",
        );
      }

      const detected = await fileTypeFromBuffer(buffer);
      const extension = detected
        ? SUPPORTED_IMAGE_TYPES[
            detected.mime as keyof typeof SUPPORTED_IMAGE_TYPES
          ]
        : undefined;
      if (!detected || !extension) {
        throw new ProductImageValidationError(
          "Only JPEG, PNG, and WebP images are supported.",
        );
      }

      await mkdir(root, { recursive: true });
      const filename = `${randomUUID()}.${extension}`;
      const filePath = managedPath(filename);
      if (!filePath) throw new Error("Generated image filename is invalid.");
      const temporaryPath = join(root, `.${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, buffer, { flag: "wx" });
        await rename(temporaryPath, filePath);
      } catch (error) {
        try {
          await unlink(temporaryPath);
        } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") {
            throw cleanupError;
          }
        }
        throw error;
      }
      return {
        imageUrl: `/uploads/products/${filename}`,
        filename,
        filePath,
      };
    },
    async remove(imageUrl) {
      if (!imageUrl || !/^\/uploads\/products\/[^/]+$/.test(imageUrl)) return;
      const filename = imageUrl.slice("/uploads/products/".length);
      const filePath = managedPath(filename);
      if (!filePath || !filePath.startsWith(`${root}${sep}`)) return;
      try {
        await unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
    resolvePublicFile(filename) {
      const filePath = managedPath(filename);
      return filePath && filePath.startsWith(`${root}${sep}`) ? filePath : null;
    },
    async read(filename) {
      const filePath = this.resolvePublicFile(filename);
      if (!filePath) return null;
      try {
        return await readFile(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}
