require("dotenv").config();
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);
const path = require("path");
const rooms = {};
const socketToRoom = {};
io.on("connection", (socket) => {
  socket.on("join room", (roomID) => {
    if (rooms[roomID]) {
      rooms[roomID].push(socket.id);
    } else {
      rooms[roomID] = [socket.id];
    }
    socketToRoom[socket.id] = roomID;
    const otherUsers = rooms[roomID].filter((id) => id !== socket.id);
    console.log(otherUsers);
    if (otherUsers) {
      socket.emit("other user", otherUsers);
      socket.to(otherUsers).emit("user joined", socket.id);
    }
  });
  socket.on("offer", (payload) => {
    io.to(payload.target).emit("offer", payload);
  });

  socket.on("answer", (payload) => {
    io.to(payload.target).emit("answer", payload);
  });

  socket.on("ice-candidate", (incoming) => {
    io.to(incoming.target).emit("ice-candidate", incoming);
  });
});
if (process.env.PROD) {
  app.use(express.static(path.join(__dirname, "./client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "./client/build/index.html"));
  });
}
const port = process.env.PORT || 8000;
server.listen(port, () => {
  console.log("Server is listening on port " + port);
});
