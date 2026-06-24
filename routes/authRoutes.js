const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");

const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const sendEmail = require("../utils/sendEmail");

let registerOtpStore = {};





router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Please fill all fields",
      });
    }

    
    const existingEmail = await User.findOne({
      email,
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        msg: "Email already registered",
      });
    }

    
    const existingUsername = await User.findOne({
      username,
    });

    if (existingUsername) {
      return res.status(400).json({
        success: false,
        msg: "Username already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    registerOtpStore[email] = {
      username,
      email,
      password: hashedPassword,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    await sendEmail(email, otp);

    res.status(200).json({
      success: true,
      msg: "OTP sent to email",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      msg: error.message || "Failed to send OTP",
    });
  }
});





router.post(
  "/verify-register-otp",
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      const storedData =
        registerOtpStore[email];

      if (!storedData || Date.now() > storedData.expiresAt) {
        return res.status(400).json({
          success: false,
          msg: "OTP expired",
        });
      }

      if (storedData.otp !== otp) {
        return res.status(400).json({
          success: false,
          msg: "Invalid OTP",
        });
      }

      const user = await User.create({
        username:
          storedData.username,
        email: storedData.email,
        password:
          storedData.password,
      });

      delete registerOtpStore[email];

      const token = jwt.sign(
        {
          id: user._id,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      res.status(201).json({
        success: true,
        msg: "Signup successful",
        token,
        user: {
          id: user._id,
          username:
            user.username,
          email: user.email,
          wins: user.wins,
          losses: user.losses,
          matchesPlayed:
            user.matchesPlayed,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        msg: error.message,
      });
    }
  }
);





router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("[/api/auth/login] Request body:", { emailPresent: !!email, passwordPresent: !!password });

    if (!email || !password) {
      console.warn("[/api/auth/login] Missing fields", { body: req.body });
      return res.status(400).json({
        success: false,
        msg: "Please provide email and password",
      });
    }

    const user = await User.findOne({
      email,
    });

    if (!user) {
      console.warn("[/api/auth/login] User not found for email", email);
      return res.status(400).json({
        success: false,
        msg: "User not found",
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {
      console.warn("[/api/auth/login] Invalid password attempt for", email);
      return res.status(400).json({
        success: false,
        msg: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      success: true,
      msg: "Login successful",
      token,
      user: {
        id: user._id,
        username:
          user.username,
        email: user.email,
        wins: user.wins,
        losses: user.losses,
        matchesPlayed:
          user.matchesPlayed,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: error.message,
    });
  }
});





router.post(
  "/logout",
  authMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          msg: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        msg: "Logout successful",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        msg: error.message,
      });
    }
  }
);

router.get(
  "/profile",
  authMiddleware,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        ).select("-password");

      res.json(user);
    } catch (error) {
      res.status(500).json({
        msg: error.message,
      });
    }
  }
);

module.exports = router;