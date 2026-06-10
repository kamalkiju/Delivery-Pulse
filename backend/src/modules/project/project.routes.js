import express from "express";
import { authMiddleware } from "../auth/auth.middleware.js";
import { getProjects, createProject, updateProject, deleteProject } from "./project.controller.js";

const router = express.Router();
router.get("/", authMiddleware, getProjects);
router.post("/", authMiddleware, createProject);
router.patch("/:id", authMiddleware, updateProject);
router.delete("/:id", authMiddleware, deleteProject);
export default router;
