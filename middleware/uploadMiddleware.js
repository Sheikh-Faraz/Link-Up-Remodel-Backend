const multer = require ('multer');
const path = require ("path");

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // folder where files will be saved
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  }
});

// Filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/png", 
    "image/jpeg", 
    "image/jpg", 
    "application/pdf", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "audio/webm", // ✅ add for browser voice recordings
    "audio/mpeg", // ✅ add for mp3
    "audio/wav"   // ✅ add for wav files
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Unsupported file type"), false);
};

// export const upload = multer({ storage, fileFilter });
const upload = multer({ storage, fileFilter });

module.exports = { upload };
