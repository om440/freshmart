import { Router, type Request, type RequestHandler } from "express";
import multer from "multer";
import type { ProductImageStorage } from "./image-storage.js";
import {
  MAX_PRODUCT_IMAGE_SIZE,
  ProductImageValidationError,
} from "./image-storage.js";

export interface ProductImageRepository {
  findActiveImage(
    productId: string,
  ): Promise<{ imageUrl: string | null } | null>;
  updateActiveImage(productId: string, imageUrl: string): Promise<boolean>;
}

interface ProductImageRouterOptions {
  repository: ProductImageRepository;
  storage: ProductImageStorage;
}

function validProductId(value: string): boolean {
  if (!/^[1-9]\d*$/.test(value)) return false;
  try {
    return BigInt(value) <= 9223372036854775807n;
  } catch {
    return false;
  }
}

export function createProductImageRouter({
  repository,
  storage,
}: ProductImageRouterOptions) {
  const router = Router();
  const parseUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PRODUCT_IMAGE_SIZE, files: 1 },
  }).single("image");

  const handleUploadParseError: RequestHandler = (request, response, next) => {
    parseUpload(request, response, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      const oversized =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      response.status(oversized ? 413 : 400).json({
        error: oversized
          ? "Image must be 5 MiB or smaller."
          : "Image upload is malformed.",
      });
    });
  };

  router.post(
    "/:id/image",
    handleUploadParseError,
    async (request: Request<{ id: string }>, response, next) => {
      const productId = request.params.id;
      if (!validProductId(productId)) {
        response.status(400).json({ error: "Product ID is invalid." });
        return;
      }
      if (!request.file) {
        response.status(400).json({ error: "An image file is required." });
        return;
      }

      const currentProduct = await repository.findActiveImage(productId);
      if (!currentProduct) {
        response.status(404).json({ error: "Active product was not found." });
        return;
      }

      let stored;
      try {
        stored = await storage.save(request.file.buffer);
      } catch (error) {
        if (!(error instanceof ProductImageValidationError)) {
          next(error);
          return;
        }
        response.status(400).json({
          error: error.message,
        });
        return;
      }

      try {
        const updated = await repository.updateActiveImage(
          productId,
          stored.imageUrl,
        );
        if (!updated) {
          await storage.remove(stored.imageUrl);
          response.status(404).json({ error: "Active product was not found." });
          return;
        }
      } catch (error) {
        await storage.remove(stored.imageUrl);
        throw error;
      }

      try {
        await storage.remove(currentProduct.imageUrl);
      } catch (error) {
        console.error("Could not remove replaced product image.", error);
      }
      response.json({ imageUrl: stored.imageUrl });
    },
  );

  return router;
}

export function createPublicProductImageRouter(storage: ProductImageStorage) {
  const router = Router();
  router.get("/:filename", (request, response, next) => {
    const filePath = storage.resolvePublicFile(request.params.filename);
    if (!filePath) {
      response.sendStatus(404);
      return;
    }
    response.sendFile(filePath, (error) => {
      if (!error) return;
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" &&
        !response.headersSent
      ) {
        response.sendStatus(404);
        return;
      }
      next(error);
    });
  });
  return router;
}
