import express from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  getStats,
  getClients,
  getActivity,
  getSprintHealth,
  getCommitments,
} from "./dashboard.controller.js";

const router = express.Router();

router.use(requireAuth);

router.get("/stats", getStats);
router.get("/clients", getClients);
router.get("/activity", getActivity);
router.get("/sprint-health", getSprintHealth);
router.get("/commitments", getCommitments);

export default router;
