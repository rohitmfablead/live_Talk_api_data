import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Group from "../models/Group.js";

// Define multiple call duration options (in milliseconds)
const CALL_DURATIONS = {
  15: 15 * 60 * 1000,  // 15 minutes
  30: 30 * 60 * 1000,  // 30 minutes
  45: 45 * 60 * 1000   // 45 minutes
};

// Default call duration (30 minutes)
const DEFAULT_CALL_DURATION = CALL_DURATIONS[30];

const onlineUsers = new Map();   // userId -> socketId
const socketToUser = new Map();  // socketId -> userId
const activeCalls = new Map();   // callId -> { ... }
const callTimeouts = new Map();  // callId -> timeoutId
const typingUsers = new Map();   // conversationId -> { userId, timestamp }

const initSocket = (io) => {
  // auth middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = { id: user._id.toString() };
      next();
    } catch (err) {
      console.error("Socket auth error:", err.message);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.id;
    console.log("User connected:", userId, socket.id);

    onlineUsers.set(userId, socket.id);
    socketToUser.set(socket.id, userId);

    await User.findByIdAndUpdate(userId, {
      status: "online",
      lastSeen: new Date(),
    });

    socket.broadcast.emit("user:status", {
      userId,
      status: "online",
    });

    // Helper function to end a call automatically
    const endCallAutomatically = (callId) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      // Clear any existing timeout for this call
      if (callTimeouts.has(callId)) {
        clearTimeout(callTimeouts.get(callId));
        callTimeouts.delete(callId);
      }

      const callerSocketId = onlineUsers.get(call.callerId);
      const receiverSocketId = onlineUsers.get(call.receiverId);

      if (callerSocketId) {
        io.to(callerSocketId).emit("call:ended", { callId, reason: "timeout" });
      }
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:ended", { callId, reason: "timeout" });
      }

      activeCalls.delete(callId);
      console.log(`Call ${callId} ended due to timeout`);
    };

    // Handle typing indicators
    socket.on("typing:start", (data) => {
      const { receiverId, groupId } = data;
      
      if (groupId) {
        // For group messages, notify all group members except sender
        Group.findById(groupId).then(group => {
          if (group) {
            group.memberIds.forEach(memberId => {
              const memberSocketId = onlineUsers.get(memberId.toString());
              if (memberSocketId && memberId.toString() !== userId) {
                io.to(memberSocketId).emit("typing:start", {
                  userId: userId,
                  groupId: groupId,
                });
              }
            });
          }
        }).catch(err => {
          console.error("Error fetching group for typing indicator:", err);
        });
      } else if (receiverId) {
        // For private messages
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("typing:start", {
            userId: userId,
          });
        }
      }
    });

    socket.on("typing:stop", (data) => {
      const { receiverId, groupId } = data;
      
      if (groupId) {
        // For group messages, notify all group members except sender
        Group.findById(groupId).then(group => {
          if (group) {
            group.memberIds.forEach(memberId => {
              const memberSocketId = onlineUsers.get(memberId.toString());
              if (memberSocketId && memberId.toString() !== userId) {
                io.to(memberSocketId).emit("typing:stop", {
                  userId: userId,
                  groupId: groupId,
                });
              }
            });
          }
        }).catch(err => {
          console.error("Error fetching group for typing indicator:", err);
        });
      } else if (receiverId) {
        // For private messages
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("typing:stop", {
            userId: userId,
          });
        }
      }
    });

    // call:initiate
    socket.on("call:initiate", async (payload) => {
      try {
        const { toUserId, type, callId, duration = 30 } = payload;

        const receiverSocketId = onlineUsers.get(toUserId);
        if (!receiverSocketId) {
          socket.emit("call:error", {
            message: "User is offline",
          });
          return;
        }

        const effectiveCallId =
          callId || `${userId}-${toUserId}-${Date.now()}`;

        // Validate duration option
        const callDuration = CALL_DURATIONS[duration] || DEFAULT_CALL_DURATION;

        activeCalls.set(effectiveCallId, {
          callerId: userId,
          receiverId: toUserId,
          type,
          status: "ringing",
          startedAt: new Date(),
          duration: callDuration  // Store the selected duration
        });

        io.to(receiverSocketId).emit("call:incoming", {
          callId: effectiveCallId,
          fromUserId: userId,
          type,
          duration  // Send duration info to receiver
        });

        socket.emit("call:initiated", {
          callId: effectiveCallId,
          toUserId,
          type,
          duration  // Confirm duration to initiator
        });
      } catch (err) {
        console.error("call:initiate error:", err);
        socket.emit("call:error", { message: "Unable to initiate call" });
      }
    });

    socket.on("call:accept", (payload) => {
      const { callId } = payload;
      const call = activeCalls.get(callId);
      if (!call) return;

      call.status = "accepted";
      call.acceptedAt = new Date();
      activeCalls.set(callId, call);

      // Set automatic timeout for the call using the stored duration
      const callDuration = call.duration || DEFAULT_CALL_DURATION;
      const timeoutId = setTimeout(() => {
        endCallAutomatically(callId);
      }, callDuration);
      
      callTimeouts.set(callId, timeoutId);

      const callerSocketId = onlineUsers.get(call.callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:accepted", { callId });
      }
    });

    socket.on("call:reject", (payload) => {
      const { callId, reason = "declined" } = payload;
      const call = activeCalls.get(callId);
      if (!call) return;

      // Clear timeout if it exists
      if (callTimeouts.has(callId)) {
        clearTimeout(callTimeouts.get(callId));
        callTimeouts.delete(callId);
      }

      const callerSocketId = onlineUsers.get(call.callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:rejected", { callId, reason });
      }

      activeCalls.delete(callId);
    });

    socket.on("call:cancel", (payload) => {
      const { callId } = payload;
      const call = activeCalls.get(callId);
      if (!call) return;

      // Clear timeout if it exists
      if (callTimeouts.has(callId)) {
        clearTimeout(callTimeouts.get(callId));
        callTimeouts.delete(callId);
      }

      const receiverSocketId = onlineUsers.get(call.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:cancelled", { callId });
      }

      activeCalls.delete(callId);
    });

    socket.on("call:end", (payload) => {
      const { callId } = payload;
      const call = activeCalls.get(callId);
      if (!call) return;

      // Clear timeout if it exists
      if (callTimeouts.has(callId)) {
        clearTimeout(callTimeouts.get(callId));
        callTimeouts.delete(callId);
      }

      const callerSocketId = onlineUsers.get(call.callerId);
      const receiverSocketId = onlineUsers.get(call.receiverId);

      if (callerSocketId) {
        io.to(callerSocketId).emit("call:ended", { callId });
      }
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:ended", { callId });
      }

      activeCalls.delete(callId);
      // yahan se REST se call log save kar sakte ho chahe
    });

    // Chat message handling
    socket.on("message:send", async (payload) => {
      try {
        const { receiverId, groupId, content, type = "text" } = payload;
        const senderId = userId;

        // Validate that either receiverId or groupId is provided, but not both
        if ((!receiverId && !groupId) || (receiverId && groupId)) {
          socket.emit("message:error", { message: "Either receiverId or groupId must be provided, but not both" });
          return;
        }

        let messageData = {
          senderId,
          content,
          type,
        };

        if (receiverId) {
          // Private message
          const receiverSocketId = onlineUsers.get(receiverId);
          
          // Check if receiver exists
          const receiver = await User.findById(receiverId);
          if (!receiver) {
            socket.emit("message:error", { message: "Receiver not found" });
            return;
          }
          
          messageData.receiverId = receiverId;
          
          // Save message to database
          const message = await Message.create(messageData);
          
          // Populate sender info
          await message.populate("senderId", "name avatarUrl");
          
          // Send message to receiver if online
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("message:receive", {
              message: {
                ...message.toObject(),
                sender: message.senderId
              }
            });
          }
          
          // Send confirmation to sender
          socket.emit("message:sent", {
            message: {
              ...message.toObject(),
              sender: message.senderId
            }
          });
        } else if (groupId) {
          // Group message
          const group = await Group.findOne({
            _id: groupId,
            memberIds: senderId,
          });
          
          if (!group) {
            socket.emit("message:error", { message: "Group not found or access denied" });
            return;
          }
          
          messageData.groupId = groupId;
          
          // Save message to database
          const message = await Message.create(messageData);
          
          // Populate sender info
          await message.populate("senderId", "name avatarUrl");
          await message.populate("groupId", "name");
          
          // Send message to all online group members except sender
          group.memberIds.forEach(memberId => {
            const memberSocketId = onlineUsers.get(memberId.toString());
            if (memberSocketId && memberId.toString() !== userId) {
              io.to(memberSocketId).emit("message:receive", {
                message: {
                  ...message.toObject(),
                  sender: message.senderId,
                  group: message.groupId
                }
              });
            }
          });
          
          // Send confirmation to sender
          socket.emit("message:sent", {
            message: {
              ...message.toObject(),
              sender: message.senderId,
              group: message.groupId
            }
          });
        }
      } catch (err) {
        console.error("Send message error:", err);
        socket.emit("message:error", { message: "Failed to send message" });
      }
    });

    // Message read status
    socket.on("message:read", async (payload) => {
      try {
        const { messageId } = payload;
        
        // Update message as read in database
        const message = await Message.findByIdAndUpdate(
          messageId,
          { read: true, readAt: new Date() },
          { new: true }
        ).populate("senderId", "name avatarUrl");

        if (message) {
          // Notify sender if online
          const senderSocketId = onlineUsers.get(message.senderId._id.toString());
          if (senderSocketId) {
            io.to(senderSocketId).emit("message:read", {
              messageId: message._id,
              read: true,
              readAt: message.readAt
            });
          }
        }
      } catch (err) {
        console.error("Mark message as read error:", err);
      }
    });

    socket.on("webrtc:offer", (payload) => {
      const { callId, offer } = payload;
      const call = activeCalls.get(callId);
      if (!call) return;

      const targetSocketId = onlineUsers.get(call.receiverId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:offer", { callId, offer });
      }
    });

    socket.on("webrtc:answer", (payload) => {
      const { callId, answer } = payload;
      const call = activeCalls.get(callId);
      if (!call) return;

      const targetSocketId = onlineUsers.get(call.callerId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:answer", { callId, answer });
      }
    });

    socket.on("webrtc:ice-candidate", (payload) => {
      const { callId, candidate, fromRole } = payload;
      const call = activeCalls.get(callId);
      if (!call) return;

      let targetUserId;
      if (fromRole === "caller") {
        targetUserId = call.receiverId;
      } else if (fromRole === "receiver") {
        targetUserId = call.callerId;
      }

      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:ice-candidate", {
          callId,
          candidate,
        });
      }
    });

    socket.on("disconnect", async () => {
      const userId = socketToUser.get(socket.id);
      console.log("Socket disconnected:", socket.id, "user:", userId);

      if (userId) {
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);

        await User.findByIdAndUpdate(userId, {
          status: "offline",
          lastSeen: new Date(),
        });

        socket.broadcast.emit("user:status", {
          userId,
          status: "offline",
        });
      }

      for (const [callId, call] of activeCalls.entries()) {
        if (call.callerId === userId || call.receiverId === userId) {
          // Clear timeout if it exists
          if (callTimeouts.has(callId)) {
            clearTimeout(callTimeouts.get(callId));
            callTimeouts.delete(callId);
          }

          const otherUserId =
            call.callerId === userId ? call.receiverId : call.callerId;
          const otherSocketId = onlineUsers.get(otherUserId);
          if (otherSocketId) {
            io.to(otherSocketId).emit("call:ended", {
              callId,
              reason: "peer_disconnected",
            });
          }
          activeCalls.delete(callId);
        }
      }
    });
  });
};

export default initSocket;