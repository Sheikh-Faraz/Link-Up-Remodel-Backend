const express = require ('express');
const { authMiddleware } = require ('../middleware/authMiddleware.js');
const { upload } = require ("../middleware/uploadMiddleware.js");
const { 
        getUsersForSidebar,
        addContact, 
        getUserInfo,
        getMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        forwardMessage,
        reactToMessage,
        markAsSeen,
        updateProfile,
        blockUser,
        unblockUser,
        deleteUser,
        clearChat,
        getDeletedOrBlockedUsers,
        restoreUser,
    } = require ('../controllers/actionsController.js');

const router = express.Router();

router.get("/users", authMiddleware, getUsersForSidebar);
router.get("/UserInfo", authMiddleware, getUserInfo);
router.post('/add-contact', authMiddleware, addContact);


router.get('/messages/:receiverId', authMiddleware, getMessages);

router.post('/send-message', upload.single("file"), authMiddleware, sendMessage);

router.patch("/:id/edit", authMiddleware, editMessage);
router.delete("/:id", authMiddleware, deleteMessage);

// Work on this/implement later not important for now 
router.post("/forward", authMiddleware, forwardMessage);
router.post("/:id/react", authMiddleware, reactToMessage);
router.post("/seen", authMiddleware, markAsSeen);

router.patch("/update-profile", upload.single("profilePic"), authMiddleware, updateProfile);
router.patch("/block/:id", authMiddleware, blockUser); // For blocking the user
router.patch("/unblock/:id", authMiddleware, unblockUser); // For unblocking the user

router.delete("/delete/:id", authMiddleware, deleteUser); // For deleting the user account

router.delete("/clearChat/:id", authMiddleware, clearChat); // For clearing chat with a contact
        
router.get("/hidden", authMiddleware, getDeletedOrBlockedUsers);  // Get the user for restore side bar

router.patch("/restore/:id", authMiddleware, restoreUser); // For restoring deleted user 

module.exports = router; 
