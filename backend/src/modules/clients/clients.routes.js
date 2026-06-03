import express from "express";
import { authMiddleware } from "../auth/auth.middleware.js";
import { getClients, getClientById } from "./clients.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getClients);
router.get("/:id", getClientById);

export default router;
