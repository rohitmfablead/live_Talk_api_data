import User from "../models/User.js";

// GET /users - list users (contacts)
const getUsers = async (req, res) => {
  try {
    const search = req.query.search || "";

    const query = {
      _id: { $ne: req.user._id },
      ...(search && {
        name: { $regex: search, $options: "i" },
      }),
    };

    const users = await User.find(query)
      .select("name email avatarUrl status lastSeen")
      .sort({ name: 1 });

    res.json({ users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /users/:id - single user
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name email avatarUrl status lastSeen"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /users/profile - update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, avatarUrl } = req.body;

    // Validate input
    const updates = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name must be a non-empty string" });
      }
      updates.name = name.trim();
    }
    
    if (avatarUrl !== undefined) {
      if (typeof avatarUrl !== 'string') {
        return res.status(400).json({ message: "Avatar URL must be a string" });
      }
      updates.avatarUrl = avatarUrl;
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    // Update user profile
    const user = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select("name email avatarUrl status lastSeen");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("Update user profile error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export { getUsers, getUserById, updateUserProfile };