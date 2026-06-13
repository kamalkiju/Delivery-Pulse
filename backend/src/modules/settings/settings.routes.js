import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { saveTeamsWebhook, getTeamsWebhook } from "./settings.controller.js";

const router = express.Router();

router.post("/teams-webhook", authMiddleware, saveTeamsWebhook);
router.get("/teams-webhook", authMiddleware, getTeamsWebhook);

export default router;
