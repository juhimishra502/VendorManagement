import { Router } from "express";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { getDocumentForDownload, ServiceError } from "../services/vendor-service.js";

// Documents are never exposed as raw Base64 to the browser. This endpoint
// decodes the stored data and streams the binary, after checking the caller
// may access the owning vendor.
export const documentsRouter = Router();

documentsRouter.use(requireAuth);

documentsRouter.get("/:id/download", async (request, response) => {
  try {
    const doc = await getDocumentForDownload(String(request.params.id), request.auth!);
    const safeName = doc.fileName.replace(/[^\w.\- ]/g, "_");
    response.setHeader("Content-Type", doc.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    response.send(doc.buffer);
  } catch (error) {
    if (error instanceof ServiceError) {
      response.status(error.status).json({ success: false, error: error.message });
      return;
    }
    logger.error({ err: error }, "Document download error");
    response.status(500).json({ success: false, error: "Internal server error" });
  }
});
