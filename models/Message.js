const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },

    fileName: { type: String }, // 🆕 stores uploaded file path or link
    fileUrl: { type: String }, // 🆕 stores uploaded file path or link
    fileType: { type: String }, // 🆕 "image", "pdf", "docx", etc.

    // Edit/Delete
    isEdited: { type: Boolean, default: false },
    isDeletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Forward / Reply
    // Side Note: From myself as a suggestion just maybe added to the forwarded message forward and may not require user id
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    replyTo: [
      { 
        text: String,
        fileUrl: { type: String },
        fileType: { type: String },
        fileName: { type: String },
      },
    ],

    // Reactions
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String },
      },
    ],

    // Seen/Read
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);

