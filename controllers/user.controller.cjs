const userModel = require("../models/user.schema.cjs");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const { verifyEmailTemplate } = require("../utils/emailTemplates");

exports.register = async (req, res) => {
  try {
    const { phone, age, username, email, password } = req.body;

    // 1. Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    // 2. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Check if email already exists
    const existingUser = await userModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists!" });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(String(password), 10);

    // 5. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // 6. Hash token before saving it in database
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    // 7. Token expires after 15 minutes
    const verificationTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    // 8. Create user
    const newUser = userModel({
      phone,
      age,
      username,
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      verificationToken: hashedVerificationToken,
      verificationTokenExpires,
    });

    // 9. Save user
    const user = await newUser.save();

    // 10. Create verification URL
    const baseUrl =
      process.env.FRONTEND_URL || "http://localhost:5000/api/users";
    const verificationUrl = `${baseUrl}/verify-email/${verificationToken}`;

    // 11. Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Evo Store Account",
        html: verifyEmailTemplate(user.username, verificationUrl),
      });
    } catch (emailError) {
      console.error("Verification email failed:", emailError.message);

      // Remove user if email could not be sent
      await userModel.findByIdAndDelete(user._id);
      return res
        .status(500)
        .json({ message: "Could not send verification email" });
    }

    // 12. Success response
    return res.status(201).json({
      message:
        "Registration successful. Please check your email to verify your account.",
    });
  } catch (error) {
    console.log("Error in register controller", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists!" });
    }

    return res.status(500).json({ message: "Internal server error", error });
  }
};

// verify Email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // 1. Hash the token received from the URL
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // 2. Find the user by token
    const user = await userModel.findOne({
      verificationToken: hashedToken,
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid verification token",
      });
    }

    // 3. Check token expiration
    if (user.verificationTokenExpires < new Date()) {
      return res.status(400).json({
        message: "Verification token has expired",
      });
    }

    // 4. Verify user
    user.isVerified = true;

    // 5. Remove token after successful verification
    user.verificationToken = null;
    user.verificationTokenExpires = null;

    await user.save();

    return res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Error in verify email:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // 2. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Find user
    const user = await userModel.findOne({ email: normalizedEmail });

    // 4. Check user and password
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 5. Check email verification
    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email first",
      });
    }

    // 6. Create JWT
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    // 7. Store JWT in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // 8. Send response
    return res.status(200).json({
      message: "User logged in successfully",
      user: {
        _id: user._id,
        name: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// logout user
exports.logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error in logout:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get Profile
exports.getProfile = async (req, res) => {
  try {
    // جلب الـ ID من التوكن (req.user) الذي أضافه الميدل وير
    // ملاحظة: تأكد من اسم المتغير حسب ما قمت بتخزينه أثناء عمل jwt.sign (قد يكون id أو _id)
    const userId = req.user._id || req.user.id || req.user.userId;

    const user = await userModel.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود!" });
    }

    return res
      .status(200)
      .json({ message: "Profile retrieved successfully", data: user });
  } catch (error) {
    console.log("Error getting profile:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// update user profile
exports.updateProfileUser = async (req, res) => {
  try {
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Request body:", req.body);
    const { password, email, ...updateData } = req.body;
    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v != null),
    );

    const updateUser = await userModel
      .findByIdAndUpdate(req.user._id, cleanData, {
        returnDocument: "after",
        runValidators: true,
      })
      .select("-password");

    if (!updateUser) {
      return res.status(404).json({ message: "User not found!" });
    }
    return res.status(200).json({
      message: "Profile updated successfully",
      data: updateUser,
    });
  } catch (error) {
    console.log("Error updating profile:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get all users
exports.getAllUsers = async (req, res) => {
  try {
    const useres = await userModel.find();
    return res
      .status(200)
      .json({ message: "Useres retrieved successfully", data: useres });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }
    return res
      .status(200)
      .json({ message: "User retrieved successfully", user: user });
  } catch (error) {
    console.log("Error getting user by ID:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    return res.status(500).json({ message: "Server Error" });
  }
};

// update user by id
exports.updateUserById = async (req, res) => {
  try {
    const { username, email, role } = req.body || {};

    const updateData = {};

    if (username !== undefined) {
      updateData.username = username;
    }

    if (email !== undefined) {
      updateData.email = email;
    }

    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }

      updateData.role = role;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided",
      });
    }

    const user = await userModel.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error updating user:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }
    await userModel.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log("Error deleting user:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    return res.status(500).json({ message: "Server Error" });
  }
};
