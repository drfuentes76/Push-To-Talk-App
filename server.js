const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

io.on('connection', socket => {
  socket.on('join', name => socket.nickname = name);

  socket.on('message', msg => {
    io.emit('message', `${socket.nickname || 'Anonymous'}: ${msg}`);
  });

  socket.on('voice', blob => {
    io.emit('message', `${socket.nickname || 'Anonymous'} sent a voice note`);
  });

  socket.on('file', file => {
    io.emit('message', `${socket.nickname || 'Anonymous'} sent a file: ${file.name}`);
  });

  socket.on('location', loc => {
    io.emit('message', `${socket.nickname || 'Anonymous'} shared location: (${loc.lat}, ${loc.lon})`);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
