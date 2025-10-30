const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
{
    UserId: {
        type: String,
        unique: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
    },

    about: {
      type: String,
    },

    passwordHash: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long"],
      required: function() {
        return this.provider === "local";
      },
    },


    profilePic: {
      type: String,
      default: "",
    },

    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isDeletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    provider: { 
      type: String,
      enum: ["local", "google"], 
      default: "local" 
    },

})

module.exports = mongoose.model("User", userSchema);