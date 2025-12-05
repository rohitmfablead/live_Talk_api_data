import Group from "../models/Group.js";
import User from "../models/User.js";

// Create a new group
const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds = [] } = req.body;
    const adminId = req.user._id;

    // Validate that all members exist
    const members = await User.find({
      _id: { $in: [...memberIds, adminId] },
    });

    if (members.length !== [...memberIds, adminId].length) {
      return res.status(400).json({ message: "One or more members not found" });
    }

    // Create the group with admin as both admin and member
    const group = await Group.create({
      name,
      description,
      adminIds: [adminId],
      memberIds: [...new Set([...memberIds, adminId])], // Ensure no duplicates
    });

    res.status(201).json({ group });
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all groups for the current user
const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({
      memberIds: userId,
    }).populate("adminIds", "name avatarUrl");

    res.json({ groups });
  } catch (err) {
    console.error("Get user groups error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get group details
const getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({
      _id: groupId,
      memberIds: userId,
    }).populate("adminIds", "name avatarUrl")
      .populate("memberIds", "name avatarUrl status lastSeen");

    if (!group) {
      return res.status(404).json({ message: "Group not found or access denied" });
    }

    res.json({ group });
  } catch (err) {
    console.error("Get group error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add members to group
const addGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    // Check if user is admin
    const group = await Group.findOne({
      _id: groupId,
      adminIds: userId,
    });

    if (!group) {
      return res.status(403).json({ message: "Only admins can add members" });
    }

    // Validate that all members exist
    const members = await User.find({
      _id: { $in: memberIds },
    });

    if (members.length !== memberIds.length) {
      return res.status(400).json({ message: "One or more members not found" });
    }

    // Add members to group (avoid duplicates)
    group.memberIds = [...new Set([...group.memberIds, ...memberIds])];
    await group.save();

    // Populate the updated member list
    await group.populate("memberIds", "name avatarUrl status lastSeen");

    res.json({ group });
  } catch (err) {
    console.error("Add group members error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove members from group
const removeGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    // Check if user is admin
    const group = await Group.findOne({
      _id: groupId,
      adminIds: userId,
    });

    if (!group) {
      return res.status(403).json({ message: "Only admins can remove members" });
    }

    // Prevent removing all admins
    const remainingAdmins = group.adminIds.filter(
      (adminId) => !memberIds.includes(adminId.toString())
    );

    if (remainingAdmins.length === 0) {
      return res.status(400).json({ message: "Cannot remove all admins" });
    }

    // Remove members from group
    group.memberIds = group.memberIds.filter(
      (memberId) => !memberIds.includes(memberId.toString())
    );
    await group.save();

    // Populate the updated member list
    await group.populate("memberIds", "name avatarUrl status lastSeen");

    res.json({ group });
  } catch (err) {
    console.error("Remove group members error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Leave group
const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Prevent admin from leaving if they are the only admin
    const isAdmin = group.adminIds.some(
      (adminId) => adminId.toString() === userId
    );
    
    if (isAdmin && group.adminIds.length === 1) {
      return res.status(400).json({ message: "Admin cannot leave if they are the only admin. Please assign another admin first." });
    }

    // Remove user from members
    group.memberIds = group.memberIds.filter(
      (memberId) => memberId.toString() !== userId
    );

    // If user is admin, remove them from admins as well
    if (isAdmin) {
      group.adminIds = group.adminIds.filter(
        (adminId) => adminId.toString() !== userId
      );
    }

    await group.save();

    res.json({ message: "Successfully left the group" });
  } catch (err) {
    console.error("Leave group error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export {
  createGroup,
  getUserGroups,
  getGroupById,
  addGroupMembers,
  removeGroupMembers,
  leaveGroup,
};