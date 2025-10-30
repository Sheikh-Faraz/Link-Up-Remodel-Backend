const bcrypt = require ('bcryptjs');
const jwt = require ('jsonwebtoken');
const { OAuth2Client } = require ('google-auth-library');
const User = require ('../models/User.js');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper to create JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Used to generate UserId like: "SGH-15A-456987"
function generateUserId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  const part1 = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const part2 = `${digits[Math.floor(Math.random() * 10)]}${digits[Math.floor(Math.random() * 10)]}${letters[Math.floor(Math.random() * letters.length)]}`;
  const part3 = Array.from({ length: 6 }, () => digits[Math.floor(Math.random() * 10)]).join("");

  return `${part1}-${part2}-${part3}`; // Example: SGH-15A-456987
}


exports.checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Manual Signup
exports.signup = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    // Generate a unique UserId
    let UserId;
    let exists = true;
    while (exists) {
      UserId = generateUserId();
      exists = await User.findOne({ UserId });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    user = await User.create({ 
      UserId,
      email, 
      passwordHash, 
      fullName, 
      provider: "local" 
    });

    const token = generateToken(user._id);
    res.json({ token, user });

    console.log("The response: ", res);
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(500).json({ msg: "Server error" });
  }
};


// Manual Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if(!user) {
      return res.status(400).json({ msg: "User does not exist" });
    }

    if (!user || !user.passwordHash) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ msg: "Server error" });
  }
};  

// Google Login
// 

// Google Login (fixed version)
exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body; // token from frontend

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Check if user exists
    let user = await User.findOne({ email: payload.email });

    // If not, create one
    if (!user) {
      let UserId;
      let exists = true;
      while (exists) {
        UserId = generateUserId();
        exists = await User.findOne({ UserId });
      }

      user = await User.create({
        UserId,
        email: payload.email,
        fullName: payload.name,
        provider: "google",
        profilePic: payload.picture,
      });
    }

    // Generate JWT token
    const jwtToken = generateToken(user._id);

    res.json({ token: jwtToken, user });
  } catch (error) {
    console.error("googleLogin error:", error.message);
    res.status(500).json({ msg: "Google login failed" });
  }
};


exports.logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


