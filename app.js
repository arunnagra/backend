const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const roomRoutes = require("./routes/roomRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const matchRoutes = require("./routes/matchRoutes");

dotenv.config();

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "https://frontend-y5ln.onrender.com",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/match", matchRoutes);

app.get("/", (req, res) => {
  res.send("GameSphere 2.0 API is running");
});

if (process.env.MONGO_URI && mongoose.connection.readyState === 0) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));
}

module.exports = app;