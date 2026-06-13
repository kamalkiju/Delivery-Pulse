import express from "express";
import { authMiddleware } from "../auth/auth.middleware.js";
import {
  syncADOStories,
  getADOBoard,
  updateStoryFromADO,
  bulkPushToADO,
} from "./ado.controller.js";

const router = express.Router();

router.get("/sync", authMiddleware, syncADOStories);
router.get("/board", authMiddleware, getADOBoard);
router.post("/update", authMiddleware, updateStoryFromADO);
router.post("/bulk-push", authMiddleware, bulkPushToADO);

export default router;
