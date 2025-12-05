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

export { getUsers, getUserById };