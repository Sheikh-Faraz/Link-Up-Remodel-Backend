const express = require ('express');
// const { signup, login, googleLogin, checkAuth } = require ('.controllers/authController.js');
const { signup, login, googleLogin, checkAuth, logout } = require ('../controllers/authcontroller.js');
// const { authMiddleware } = require ('.middleware/authMiddleware.js');
const { authMiddleware } = require ('../middleware/authMiddleware.js');

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);

router.post("/logout", logout);

router.get("/check", authMiddleware, checkAuth);


module.exports = router;



