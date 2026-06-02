const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");

const sendEmail = require("../utils/sendEmail");


let registerOtpStore = {};
let loginOtpStore = {};





exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        msg: "All fields are required",
      });
    }

    
    const emailExist = await User.findOne({ email });

    if (emailExist) {
      return res.status(400).json({
        success: false,
        msg: "Email already registered",
      });
    }

    
    const usernameExist = await User.findOne({
      username,
    });

    if (usernameExist) {
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

    res.status(500).json({
      success: false,
      msg: error.message,
    });
  }
};





exports.verifySignupOtp = async (
  req,
  res
) => {
  try {
    const { email, otp } = req.body;

    const storedData =
      registerOtpStore[email];

    if (!storedData) {
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
      username: storedData.username,
      email: storedData.email,
      password: storedData.password,
    });

    delete registerOtpStore[email];

    
    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.status(201).json({
      success: true,
      msg: "Registration successful",
      token,

      user: {
        id: user._id,
        username: user.username,
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
};





exports.login = async (req, res) => {
  try {
    const { email, password } =
      req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "All fields are required",
      });
    }

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        msg: "Invalid credentials",
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {
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
        expiresIn: "1d",
      }
    );

    res.status(200).json({
      success: true,
      msg: "Login successful",
      token,

      user: {
        id: user._id,
        username: user.username,
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
};





exports.sendLoginOtp = async (
  req,
  res
) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        msg: "User not found",
      });
    }

    const otp = otpGenerator.generate(
      6,
      {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      }
    );

    loginOtpStore[email] = otp;

    await sendEmail(email, otp);

    res.status(200).json({
      success: true,
      msg: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: error.message,
    });
  }
};





exports.verifyLoginOtp = async (
  req,
  res
) => {
  try {
    const { email, otp } = req.body;

    const storedOtp =
      loginOtpStore[email];

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        msg: "OTP expired",
      });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({
        success: false,
        msg: "Invalid OTP",
      });
    }

    const user = await User.findOne({
      email,
    });

    delete loginOtpStore[email];

    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.status(200).json({
      success: true,
      msg: "Login successful",
      token,

      user: {
        id: user._id,
        username: user.username,
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
};