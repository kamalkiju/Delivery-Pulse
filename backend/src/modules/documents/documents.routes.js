import express from "express";
import multer from "multer";
import { authMiddleware } from "../auth/auth.middleware.js";
import { uploadDocument, getDocuments } from "./documents.controller.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", authMiddleware, getDocuments);
router.post("/upload", authMiddleware, upload.single("file"), uploadDocument);

export default router;
