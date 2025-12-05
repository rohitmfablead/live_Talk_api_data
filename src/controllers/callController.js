import Call from "../models/Call.js";

// POST /calls - create log
const createCall = async (req, res) => {
  try {
    const {
      callerId,
      receiverId,
      type,
      status,
      startedAt,
      endedAt,
      duration,
    } = req.body;

    if (!callerId || !receiverId || !type || !status || !startedAt) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const call = await Call.create({
      callerId,
      receiverId,
      type,
      status,
      startedAt,
      endedAt,
      duration,
    });

    res.status(201).json({ call });
  } catch (err) {
    console.error("Create call log error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /calls - my call history
const getCallHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const skip = (page - 1) * limit;

    const userId = req.user._id;

    const filter = {
      $or: [{ callerId: userId }, { receiverId: userId }],
    };

    const total = await Call.countDocuments(filter);

    const calls = await Call.find(filter)
      .populate("callerId", "name avatarUrl")
      .populate("receiverId", "name avatarUrl")
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      calls,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Get calls error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export { createCall, getCallHistory };