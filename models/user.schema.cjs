const mongoose = require("mongoose");
const schema = mongoose.Schema;
const bcrypt = require("bcrypt");

const userSchema = new schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  profileImg: [
    {
      url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
  ],
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  phone: {
    type: String,
    unique: true,
    trim: true,
  },
  age: {
    type: Number,
    min: 13,
    max: 100,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },

  verificationToken: {
    type: String,
    default: null,
  },

  verificationTokenExpires: {
    type: Date,
    default: null,
  },
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(String(password), this.password);
};

module.exports = mongoose.model("User", userSchema);
