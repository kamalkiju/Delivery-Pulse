import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getAdoConnections,
  addAdoConnection,
  testAdoConnection,
  deleteAdoConnection,
  setDefaultAdoConnection,
} from "./ado-connection.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getAdoConnections);
router.post("/", authMiddleware, addAdoConnection);
router.post("/:id/test", authMiddleware, testAdoConnection);
router.delete("/:id", authMiddleware, deleteAdoConnection);
router.patch("/:id/set-default", authMiddleware, setDefaultAdoConnection);

export default router;
