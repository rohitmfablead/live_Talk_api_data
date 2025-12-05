import express from "express";
import auth from "../middleware/authMiddleware.js";
import {
  sendMessage,
  getConversation,
  getGroupMessages,
  getUnreadCount,
  getRecentConversations,
  getRecentGroups,
  editMessage,
  deleteMessage,
} from "../controllers/messageController.js";

const router = express.Router();

// POST /messages - send a new message
router.post("/", auth, sendMessage);

// PUT /messages/:messageId - edit a message
router.put("/:messageId", auth, editMessage);

// DELETE /messages/:messageId - delete a message
router.delete("/:messageId", auth, deleteMessage);

// GET /messages/conversations - get recent conversations
router.get("/conversations", auth, getRecentConversations);

// GET /messages/groups - get recent groups
router.get("/groups", auth, getRecentGroups);

// GET /messages/unread - get unread messages count
router.get("/unread", auth, getUnreadCount);

// GET /messages/:userId - get conversation with a specific user
router.get("/:userId", auth, getConversation);

// GET /messages/group/:groupId - get messages for a specific group
router.get("/group/:groupId", auth, getGroupMessages);

export default router;