import Message from "../models/Message.js";
import User from "../models/User.js";
import Group from "../models/Group.js";

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, groupId, content, type = "text" } = req.body;
    const senderId = req.user._id;

    // Validate that either receiverId or groupId is provided, but not both
    if ((!receiverId && !groupId) || (receiverId && groupId)) {
      return res.status(400).json({ message: "Either receiverId or groupId must be provided, but not both" });
    }

    let messageData = {
      senderId,
      content,
      type,
    };

    // Add receiverId or groupId based on which is provided
    if (receiverId) {
      // Check if receiver exists for private messages
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({ message: "Receiver not found" });
      }
      messageData.receiverId = receiverId;
    } else if (groupId) {
      // Check if group exists and user is a member for group messages
      const group = await Group.findOne({
        _id: groupId,
        memberIds: senderId,
      });
      if (!group) {
        return res.status(404).json({ message: "Group not found or access denied" });
      }
      messageData.groupId = groupId;
    }

    // Create message
    const message = await Message.create(messageData);

    // Populate sender info
    await message.populate("senderId", "name avatarUrl");
    
    // Populate receiver or group info
    if (message.receiverId) {
      await message.populate("receiverId", "name avatarUrl");
    } else if (message.groupId) {
      await message.populate("groupId", "name");
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get conversation between two users
const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Get messages between current user and specified user
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId },
      ],
      deleted: false, // Don't fetch deleted messages
    })
      .populate("senderId", "name avatarUrl")
      .populate("receiverId", "name avatarUrl")
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { receiverId: currentUserId, senderId: userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ messages });
  } catch (err) {
    console.error("Get conversation error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get group messages
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    // Check if user is a member of the group
    const group = await Group.findOne({
      _id: groupId,
      memberIds: currentUserId,
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found or access denied" });
    }

    // Get messages for the group
    const messages = await Message.find({
      groupId: groupId,
      deleted: false, // Don't fetch deleted messages
    })
      .populate("senderId", "name avatarUrl")
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (err) {
    console.error("Get group messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get unread messages count
const getUnreadCount = async (req, res) => {
  try {
    // Return 0 for all unread counts since we're removing this feature
    res.json({ unreadCount: 0 });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get recent conversations (contacts with whom user has chatted)
const getRecentConversations = async (req, res) => {
  try {
    // Return empty conversations array since we're removing this feature
    res.json({ conversations: [] });
  } catch (err) {
    console.error("Get recent conversations error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get recent groups
const getRecentGroups = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get groups where user is a member
    const groups = await Group.find({
      memberIds: currentUserId,
    }).populate("adminIds", "name avatarUrl");

    // Get the latest message for each group
    const groupsWithLastMessage = await Promise.all(
      groups.map(async (group) => {
        const lastMessage = await Message.findOne({
          groupId: group._id,
          deleted: false,
        })
          .populate("senderId", "name avatarUrl")
          .sort({ createdAt: -1 });

        return {
          group,
          lastMessage,
        };
      })
    );

    res.json({ groups: groupsWithLastMessage });
  } catch (err) {
    console.error("Get recent groups error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Edit a message
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    // Find the message and check if the user is the sender
    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
      deleted: false,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found or unauthorized" });
    }

    // Update the message content and mark as edited
    message.content = content;
    message.edited = true;
    await message.save();

    // Populate sender info
    await message.populate("senderId", "name avatarUrl");
    
    // Populate receiver or group info
    if (message.receiverId) {
      await message.populate("receiverId", "name avatarUrl");
    } else if (message.groupId) {
      await message.populate("groupId", "name");
    }

    res.json({ message });
  } catch (err) {
    console.error("Edit message error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a message (soft delete)
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Find the message and check if the user is the sender
    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
      deleted: false,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found or unauthorized" });
    }

    // Soft delete the message
    message.deleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export { 
  sendMessage, 
  getConversation, 
  getGroupMessages,
  getUnreadCount, 
  getRecentConversations, 
  getRecentGroups,
  editMessage, 
  deleteMessage 
};