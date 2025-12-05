import express from "express";
import auth from "../middleware/authMiddleware.js";
import { getUsers, getUserById } from "../controllers/userController.js";

const router = express.Router();

// GET /users - list users (contacts)
router.get("/", auth, getUsers);

// GET /users/:id - single user
router.get("/:id", auth, getUserById);

export default router;
