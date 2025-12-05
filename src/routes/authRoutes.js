import express from "express";
import auth from "../middleware/authMiddleware.js";
import { register, login, getMe } from "../controllers/authController.js";

const router = express.Router();

// POST /auth/register
router.post("/register", register);

// POST /auth/login
router.post("/login", login);

// GET /auth/me
router.get("/me", auth, getMe);

export default router;
