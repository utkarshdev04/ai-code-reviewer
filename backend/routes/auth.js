import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// ─── Generate JWT Token ───────────────────────────────────────────────────────

function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// ─── Register ─────────────────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Please fill in all fields." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // Create new user
    const user = await User.create({ name, email, password });

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });

  } catch (err) {
    console.error("Register error:", err.message);
    return res.status(500).json({ error: "Registration failed: " + err.message });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Please provide email and password." });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.password) {
      return res.status(401).json({ error: "This account uses Google login. Please sign in with Google." });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Login failed: " + err.message });
  }
});

// ─── Google Login ─────────────────────────────────────────────────────────────

router.post("/google", async (req, res) => {
  const { name, email, googleId, avatar } = req.body;

  if (!email || !googleId) {
    return res.status(400).json({ error: "Google login failed. Missing data." });
  }

  try {
    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // Update googleId if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.avatar = avatar;
        await user.save();
      }
    } else {
      // Create new user from Google
      user = await User.create({ name, email, googleId, avatar });
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });

  } catch (err) {
    console.error("Google login error:", err.message);
    return res.status(500).json({ error: "Google login failed: " + err.message });
  }
});

// ─── Get current user ─────────────────────────────────────────────────────────

router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json(user);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }
});

export default router;