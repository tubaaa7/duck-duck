const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyaları public klasöründen sun
app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı:', socket.id);

    // Yeni oyuncu verisi
    players[socket.id] = {
        x: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 20,
        angle: 0,
        score: 0
    };

    // Mevcut oyuncuları yeni gelen oyuncuya gönder
    socket.emit('currentPlayers', players);
    // Diğer herkese yeni oyuncuyu bildir
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    // Oyuncu hareket ettiğinde
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].z = movementData.z;
            players[socket.id].angle = movementData.angle;
            socket.broadcast.emit('playerMoved', { id: socket.id, ...movementData });
        }
    });

    // Oyuncu çıktığında
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        delete players[socket.id];
        io.emit('disconnectPlayer', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor! Adres: http://localhost:${PORT}`);
});