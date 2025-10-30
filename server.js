const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require("path");
const { app, server } = require ("./lib/socket.js");


dotenv.config();

// const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());


// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


const authRoute = require ("./routes/authRoute.js");
app.use("/api/auth", authRoute);


const actionsRoute = require ("./routes/actionsRoute.js");
app.use("/api/actions", actionsRoute);


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    // app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.log(err));
