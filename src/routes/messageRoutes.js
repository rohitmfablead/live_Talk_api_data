import express from "express";
import auth from "../middleware/authMiddleware.js";
import {
  sendMessage,
  getConversation,
  getUnreadCount,
  getRecentConversations,
} from "../controllers/messageController.js";

const router = express.Router();

// POST /messages - send a new message
router.post("/", auth, sendMessage);

// GET /messages/conversations - get recent conversations
router.get("/conversations", auth, getRecentConversations);

// GET /messages/unread - get unread messages count
router.get("/unread", auth, getUnreadCount);

// GET /messages/:userId - get conversation with a specific user
router.get("/:userId", auth, getConversation);

export default router;