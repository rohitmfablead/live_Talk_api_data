import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import initSocket from "./socket/index.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Connect DB
connectDB();

// Middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.send("LiveTalk backend running (ESM)");
});

// Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

initSocket(io);

const PORT = process.env.PORT || 9999;

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});