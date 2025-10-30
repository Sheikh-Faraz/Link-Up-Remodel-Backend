const { Server } = require ("socket.io");
const http = require ("http");
const express = require ("express");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
  },
});

const getReceiverSocketId = (userId) => {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // If user selected and includes in the map then update messages seen status
//   socket.on("markMessagesAsSeen", (data) => {
//     const { senderId, receiverId } = data;
//     const senderSocketId = getReceiverSocketId(senderId);
//     if (senderSocketId) {
//       io.to(senderSocketId).emit("messagesSeenUpdate", {
//         senderId,
//         receiverId,
//       });
//     }
//     });   

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

module.exports = { io, app, server, getReceiverSocketId, userSocketMap};
