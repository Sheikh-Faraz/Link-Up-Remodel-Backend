const jwt = require("jsonwebtoken");
const User = require ('../models/User.js');
const Contact = require ('../models/Contact.js');
const Message = require ('../models/Message.js');
const { getReceiverSocketId, io, userSocketMap } = require("../lib/socket.js");

// ===================================================================================================

// New logic to get users for sidebar 
exports.getUsersForSidebar = async (req, res) => {
  try {
    // 1️⃣ Get the logged-in user's deleted list
    const loggedInUser = await User.findById(req.user.id).select("isDeletedFor");

    // 2️⃣ Get all contacts (people you’ve added)
    const contacts = await Contact.find({ user: req.user.id })
      .populate("contact", "UserId fullName profilePic email about blockedUsers isDeletedFor")
      .sort({ createdAt: -1 });

    // 3️⃣ Filter out users you have deleted
    const filteredContacts = contacts
      .map(c => c.contact)
      .filter(contact => !loggedInUser.isDeletedFor.includes(contact._id));

    res.json(filteredContacts);
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};


// ===================================================================================================

exports.getUserInfo = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Error in getUserInfo controller:", error.message);
    res.status(401).json({ message: "Invalid token" });
  }
};


// Adding user by id 
exports.addContact = async (req, res) => {
  try {
    const { targetUserId } = req.body; // example: SGH-15A-456987
    const currentUserId = req.user.id; // from your auth middleware

    const targetUser = await User.findOne({ UserId: targetUserId });
    if (!targetUser) return res.status(404).json({ msg: "User not found" });

    // Prevent self-add
    if (targetUser._id.toString() === currentUserId)
      return res.status(400).json({ msg: "You cannot add yourself" });

    // Check if already friends
    const existing = await Contact.findOne({
      user: currentUserId,
      contact: targetUser._id,
    });
    if (existing) return res.status(400).json({ msg: "Already added this user" });

    // Create mutual (two-way) contact
    await Contact.create({ user: currentUserId, contact: targetUser._id });
    await Contact.create({ user: targetUser._id, contact: currentUserId });

    
    // res.status(201).json({ msg: "Contact added successfully!" });
    res.status(201).json({
      msg: "Contact added successfully!",
        friend: {
          _id: targetUser._id,
          fullName: targetUser.fullName,
          email: targetUser.email,
          UserId: targetUser.UserId,
          profilePic: targetUser.profilePic,
        },
      });

  } catch (error) {
    console.error("Add contact error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};


exports.getMessages = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const senderId = req.user.id;

    const messages = await Message.find({
      $or: [
        { senderId: senderId, receiverId: receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
      isDeletedFor: { $ne: senderId }, // 👈 this filters out deleted-for-me messages
    }).sort({ createdAt: 1 }); // oldest first

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};



exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text, fileName} = req.body; // receiverId = Mongo _id or UserId
    const senderId = req.user.id;
    let fileUrl = null;
    let fileType = null;

    // ✅ Parse replyTo if exists and is a string
    let replyTo = [];
    if (req.body.replyTo) {
      try {
        replyTo = [JSON.parse(req.body.replyTo)];
      } catch (err) {
        console.warn("Invalid replyTo JSON:", err);
      }
    }
    
    // Optional: verify they’re friends before allowing messaging
    const areFriends = await Contact.findOne({ user: senderId, contact: receiverId });
    if (!areFriends) return res.status(403).json({ msg: "You can only message friends" });
    
    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
      // fileType = req.file.mimetype.startsWith("image") ? "image" : "document";
      // prefer using mimetype to classify
      if (req.file.mimetype.startsWith("image")) {
        fileType = "image";
      } else if (req.file.mimetype.startsWith("audio")) {
        fileType = "audio";
      } else {
        fileType = "document";
      }
    }

    // ✅ Check if receiver is online
    // const isReceiverOnline = onlineUsers.includes(receiverId.toString());
    const isReceiverOnline = !!userSocketMap[receiverId]; // true if online

    const message = await Message.create({
      senderId: senderId,
      receiverId: receiverId,
      text,
      replyTo: replyTo,
      fileUrl: fileUrl,
      fileType: fileType,
      fileName: fileName,
      seenBy: isReceiverOnline ? [receiverId] : [],
    });
    
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", message);
    }

    res.status(201).json({
        sendedMessage: {
            _id: message._id,
           senderId: message.senderId,
           receiverId: message.receiverId,
           text: message.text,
           createdAt: message.createdAt,
           replyTo: message.replyTo,
           fileUrl : message.fileUrl,
           fileType : message.fileType,
           fileName: message.fileName,
           seenBy: message.seenBy,
        },
      });    

  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};


exports.editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, receiverId } = req.body;
    const text = content;
    const userId = req.user.id;

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ msg: "Message not found" });
    // if (message.sender.toString() !== userId)
    // if (message.sender !== userId)
    //   return res.status(403).json({ msg: "Not allowed" });

    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { text, isEdited: true },
      { new: true } // returns the updated document
    );

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("editedMessage", updatedMessage);
    }

    res.json(updatedMessage);

  } catch (err) {
    console.log("This the error in EDITING MESSAGE: ",err);
    res.status(500).json({ msg: err.message });
  }
};


exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteForEveryone, receiverId } = req.body;
    const userId = req.user.id;

    const message = await Message.findById(id);
    // if (!message) return res.status(404).json({ msg: "Message not found" }); maybe is this the problem

    if (deleteForEveryone) {
      // if (message.sender.toString() !== userId)
        // return res.status(403).json({ msg: "Only sender can delete for everyone" });
        const text = "🛇 This message was deleted";
        const fileUrl = "";
        const fileType = "";
        const replyTo = [];
        const fileName = "";
        const updatedMessage = await Message.findByIdAndUpdate(
          id,
          { text, isEdited: false, fileUrl, fileType, fileName ,replyTo },
          { new: true } // returns the updated document
        );
        
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      // io.to(receiverSocketId).emit("deletedForEveryoneMessage", "🛇 This message was deleted");
      io.to(receiverSocketId).emit("deletedForEveryone", updatedMessage);
    }
        
      return res.json({ msg: "Deleted for everyone" });
    } else {
      message.isDeletedFor.push(userId);
      await message.save();
      return res.json({ msg: "Deleted for you" });
    }
  } catch (err) {
    console.log("This the error in DELETING MESSAGE: ",err);
    res.status(500).json({ msg: err.message });
  }
};



// ===================================================================================================
// Start implementing or test with these later, not important for now!
// ===================================================================================================
exports.forwardMessage = async (req, res) => {
  try {
    const { messageId, receiverId } = req.body;
    const senderId = req.user.id;

    const original = await Message.findById(messageId);
    if (!original) return res.status(404).json({ msg: "Message not found" });

    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      content: original.content,
      forwardedFrom: original.sender,
    });

    res.json(newMessage);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};


exports.reactToMessage = async (req, res) => {
  try {
    const { id } = req.params; // messageId
    const { emoji } = req.body;
    const userId = req.user.id;

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    const existingReaction = message.reactions.find(
      (r) => r.user.toString() === userId
    );

    if (existingReaction) {
      existingReaction.emoji = emoji; // update reaction
    } else {
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.markAsSeen = async (req, res) => {
  try {
    // const { id } = req.params; // messageId
    const { receiverId } = req.body; // The user selected or the one we are chatting with
    const userId = req.user.id;

    if (!receiverId) {
      return res.status(400).json({ msg: "Receiver ID is required" });
    }

    // Find all messages between the two users that the current user hasn't marked as seen
    const updated = await Message.updateMany(
      {
        $or: [
          { senderId: receiverId, receiverId: userId },
          { senderId: userId, receiverId: receiverId },
        ],
        seenBy: { $ne: userId },
      },
      { $push: { seenBy: userId } }
    );

    // res.json({ msg: "Marked as seen", message });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
// ===================================================================================================


// Updating Profile User

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, about } = req.body;
    
    let profilePic = null;
    
    if (req.file) {
      profilePic = `/uploads/${req.file.filename}`;
    }
    
    const updatedData = { fullName, about };
    
    if (profilePic) updatedData.profilePic = profilePic;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updatedData,
      { new: true }
    ).select("-passwordHash");

    res.json(updatedUser);

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};


// Blocking User 
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params; // ID of the user to block
    const userId = req.user.id; // logged-in user

    if (userId === id) return res.status(400).json({ message: "You cannot block yourself" });

    const user = await User.findById(userId);
    const targetUser = await User.findById(id);

    if (!targetUser) return res.status(404).json({ message: "User not found" });

    // Check if already blocked
    if (user.blockedUsers.includes(id)) {
      return res.status(400).json({ message: "User already blocked" });
    }

    user.blockedUsers.push(id);

    await user.save();

    res.json({ message: "User blocked successfully", blockedUsers: user.blockedUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Block user error:", error);
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user.blockedUsers.includes(id)) {
      return res.status(400).json({ message: "User not in block list" });
    }

    user.blockedUsers = user.blockedUsers.filter((uid) => uid.toString() !== id);
    await user.save();

    res.json({ message: "User unblocked successfully", blockedUsers: user.blockedUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===========================================================================================================
// Delete user account prevous logic
// exports.deleteUser = async (req, res) => {
//   try {
//     const { id } = req.params; // user you want to delete
//     const userId = req.user.id; // logged-in user
    
//     const user = await User.findById(id);
//     if (!user) return res.status(404).json({ message: "User not found" });
    
//     // Avoid duplicate entries
//     if (!user.isDeletedFor.includes(userId)) {
//       user.isDeletedFor.push(userId);
//       await user.save();
//     }
    
//     res.json({ message: "User deleted for you" });
//   } catch (error) {
//     console.error("Delete user error:", error);
//     res.status(500).json({ message: error.message });
//   }
// };


exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params; // user you want to delete
    const userId = req.user.id; // logged-in user
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
      
    // Avoid duplicate entries
    if (!user.isDeletedFor.includes(id)) {
      user.isDeletedFor.push(id);
      await user.save();
    }
    
    res.json({ message: "User deleted for you" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: error.message });
  }
}; 


// ===========================================================================================================

// Restore delete-for-me user
exports.restoreUser = async (req, res) => {
  try {
    const { id } = req.params; // user you want to restore
    const userId = req.user.id; // logged-in user

    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" }); 

    // Check if that user is currently marked as deleted
    const index = user.isDeletedFor.indexOf(id);
    if (index === -1) {
      return res.status(400).json({ message: "User is not deleted" });
    }

    // Remove the deleted user from the list
    user.isDeletedFor.splice(index, 1);
    await user.save();

    res.json({ message: "User restored successfully" });
  } catch (error) {
    console.error("Restore user error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Clear chat
exports.clearChat = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find all messages between both users
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: id },
        { senderId: id, receiverId: userId },
      ],
    });

    if (!messages.length) {
      return res.status(404).json({ msg: "No messages found" });
      console.log("No messages found between users.");
    }

    // Update all messages to mark as deleted for this user only
    await Promise.all(
      messages.map(async (message) => {
        if (!message.isDeletedFor.includes(userId)) {
          message.isDeletedFor.push(userId);
          await message.save();
        }
      })
    );

    res.json({ msg: "Chat cleared for you" });

  } catch (error) {
    console.error("Clear chat error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};


// Get user deleted-for-me or blocked for restore sidebar
// controllers/userController.js
exports.getDeletedOrBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the logged-in user first
    const user = await User.findById(userId)
      .populate("blockedUsers", "UserId fullName profilePic email about")
      .populate("isDeletedFor", "UserId fullName profilePic email about");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Combine blocked and deleted-for-me lists
    const hiddenUsersSet = new Set();

    // Add all blocked users
    user.blockedUsers.forEach((u) => hiddenUsersSet.add(u._id.toString()));

    // Add all deleted-for-me users
    user.isDeletedFor.forEach((u) => hiddenUsersSet.add(u._id.toString()));

    // Fetch full user objects for all unique IDs
    const hiddenUsers = await User.find({ _id: { $in: Array.from(hiddenUsersSet) } })
      .select("UserId fullName profilePic email about blockedUsers isDeletedFor");

    res.json(hiddenUsers);
  } catch (error) {
    console.error("Get hidden/blocked users error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};
