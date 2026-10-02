const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

const players = {};

io.on("connection", (socket) => {
  socket.on("joinGame", (data) => {
    players[socket.id] = {
      id: socket.id,
      username: data.username || "Penguen_" + Math.floor(Math.random() * 900 + 100),
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
      score: 0
    };
    socket.emit("currentPlayers", players);
    socket.broadcast.emit("newPlayer", players[socket.id]);
    io.emit("updateLeaderboard", getLeaderboardData());
  });

  socket.on("playerMovement", (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].z = movementData.z;
      players[socket.id].rotation = movementData.rotation;

      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        x: movementData.x,
        y: movementData.y,
        z: movementData.z,
        rotation: movementData.rotation
      });
    }
  });

  socket.on("updateScore", (data) => {
    if (players[socket.id]) {
      players[socket.id].score = (players[socket.id].score || 0) + (data.addedScore || 0);
      io.emit("updateLeaderboard", getLeaderboardData());
    }
  });

  socket.on("throwFish", (fishData) => {
    socket.broadcast.emit("fishThrown", {
      id: socket.id,
      x: fishData.x,
      y: fishData.y,
      z: fishData.z,
      dirX: fishData.dirX,
      dirZ: fishData.dirZ
    });
  });

  socket.on("hitPlayer", (data) => {
    const targetSocketId = data.targetId;
    if (players[targetSocketId]) {
      io.to(targetSocketId).emit("playerKnocked", {
        dirX: data.dirX,
        dirZ: data.dirZ,
        attackerId: socket.id
      });
      io.emit("playerHitEffect", {
        targetId: targetSocketId,
        x: data.targetX,
        y: data.targetY,
        z: data.targetZ,
        dirX: data.dirX,
        dirZ: data.dirZ
      });
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
    io.emit("updateLeaderboard", getLeaderboardData());
  });
});

function getLeaderboardData() {
  return Object.values(players)
    .map(p => ({ id: p.id, username: p.username, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);
}

server.listen(PORT, () => {
  console.log(`Server ${PORT} portunda aktif!`);
});
