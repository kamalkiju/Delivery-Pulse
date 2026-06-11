import express from "express";
import multer from "multer";
import { authMiddleware } from "../auth/auth.middleware.js";
import { uploadDocument, getDocuments, deleteDocument } from "./documents.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
const router = express.Router();

router.get("/", authMiddleware, getDocuments);
router.post("/upload", authMiddleware, upload.single("file"), uploadDocument);
router.delete("/:id", authMiddleware, deleteDocument);

export default router;
