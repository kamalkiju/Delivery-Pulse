import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getDashboardStats,
  getDashboardActivity,
  getDashboardClients,
  getSprintHealth,
} from "./dashboard.controller.js";

const router = express.Router();

router.get("/stats", authMiddleware, getDashboardStats);
router.get("/activity", authMiddleware, getDashboardActivity);
router.get("/clients", authMiddleware, getDashboardClients);
router.get("/sprint-health", authMiddleware, getSprintHealth);

export default router;
