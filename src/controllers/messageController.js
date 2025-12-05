import Message from "../models/Message.js";
import User from "../models/User.js";

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, type = "text" } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !content) {
      return res.status(400).json({ message: "Receiver and content are required" });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Create message
    const message = await Message.create({
      senderId,
      receiverId,
      content,
      type,
    });

    // Populate sender and receiver info
    await message.populate("senderId", "name avatarUrl");
    await message.populate("receiverId", "name avatarUrl");

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

// Get unread messages count
const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const unreadCount = await Message.countDocuments({
      receiverId: currentUserId,
      read: false,
    });

    res.json({ unreadCount });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get recent conversations (contacts with whom user has chatted)
const getRecentConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get recent conversations by finding distinct users who have messaged
    // the current user or whom the current user has messaged
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: currentUserId },
            { receiverId: currentUserId },
          ],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", currentUserId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessage: { $first: "$$ROOT" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          user: {
            _id: "$user._id",
            name: "$user.name",
            avatarUrl: "$user.avatarUrl",
            status: "$user.status",
          },
          lastMessage: 1,
          unreadCount: {
            $size: {
              $filter: {
                input: "$lastMessage",
                cond: {
                  $and: [
                    { $eq: ["$$this.receiverId", currentUserId] },
                    { $eq: ["$$this.read", false] },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $sort: { "lastMessage.createdAt": -1 },
      },
    ]);

    res.json({ conversations });
  } catch (err) {
    console.error("Get recent conversations error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export { sendMessage, getConversation, getUnreadCount, getRecentConversations };