import express from "express";
import auth from "../middleware/authMiddleware.js";
import {
  createGroup,
  getUserGroups,
  getGroupById,
  addGroupMembers,
  removeGroupMembers,
  leaveGroup,
} from "../controllers/groupController.js";

const router = express.Router();

// POST /groups - create a new group
router.post("/", auth, createGroup);

// GET /groups - get all groups for the current user
router.get("/", auth, getUserGroups);

// GET /groups/:groupId - get group details
router.get("/:groupId", auth, getGroupById);

// POST /groups/:groupId/members - add members to group
router.post("/:groupId/members", auth, addGroupMembers);

// DELETE /groups/:groupId/members - remove members from group
router.delete("/:groupId/members", auth, removeGroupMembers);

// DELETE /groups/:groupId/leave - leave group
router.delete("/:groupId/leave", auth, leaveGroup);

export default router;