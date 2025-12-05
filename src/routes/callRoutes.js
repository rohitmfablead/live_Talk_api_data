import express from "express";
import auth from "../middleware/authMiddleware.js";
import { createCall, getCallHistory } from "../controllers/callController.js";

const router = express.Router();

// POST /calls - create log
router.post("/", auth, createCall);

// GET /calls - my call history
router.get("/", auth, getCallHistory);

export default router;
