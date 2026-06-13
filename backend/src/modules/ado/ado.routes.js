import express from "express";
import { authMiddleware } from "../auth/auth.middleware.js";
import {
  syncADOStories,
  getADOBoard,
  updateStoryFromADO,
} from "./ado.controller.js";

const router = express.Router();

router.get("/sync", authMiddleware, syncADOStories);
router.get("/board", authMiddleware, getADOBoard);
router.post("/update", authMiddleware, updateStoryFromADO);

export default router;
