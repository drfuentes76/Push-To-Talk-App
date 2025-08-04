const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('.'));

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('join', (nickname) => {
    socket.nickname = nickname;
    console.log(nickname + ' joined');
    io.emit('user-list-update');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    io.emit('user-list-update');
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});