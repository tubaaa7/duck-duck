const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Port ayarı (Render dinamik port atar, yerelde 3000 kullanılır)
const PORT = process.env.PORT || 3000;

// public klasöründeki statik dosyaları (HTML, modeller, dokular) sun
app.use(express.static(path.join(__dirname, 'public')));

// Bağlı tüm oyuncuları tutan nesne
let players = {};

io.on('connection', (socket) => {
    console.log(`Yeni bir kullanıcı bağlandı: ${socket.id}`);

    // Oyuncu isim girip oyuna dahil olduğunda
    socket.on('joinGame', (username) => {
        // Yeni oyuncunun başlangıç verileri
        players[socket.id] = {
            id: socket.id,
            username: username || `Ördek_${socket.id.substring(0, 4)}`,
            x: 0,
            y: 0,
            z: 0,
            rotation: 0
        };

        // Yeni oyuncuya oyundaki mevcut diğer oyuncuları gönder
        socket.emit('currentPlayers', players);

        // Diğer oyunculara yeni katılan bu oyuncuyu bildir
        socket.broadcast.emit('newPlayer', players[socket.id]);
        
        console.log(`${players[socket.id].username} (${socket.id}) oyuna katıldı.`);
    });

    // Oyuncunun hareket verisi geldiğinde
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;

            // Hareketi diğer tüm oyunculara ilet
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Oyuncu ayrıldığında
    socket.on('disconnect', () => {
        console.log(`Kullanıcı ayrıldı: ${socket.id}`);
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('playerDisconnected', socket.id);
        }
    });
});

// Sunucuyu başlat
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif ve çalışıyor!`);
});