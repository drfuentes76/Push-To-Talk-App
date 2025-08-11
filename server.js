// server.js — Render-safe with healthcheck + Socket.IO wiring point
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  path: '/socket.io',
  maxHttpBufferSize: 2e8
});

// Healthcheck for Render
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Serve flat root (index.html next to server.js)
app.use(express.static(__dirname));
app.get('/room/:id', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- Socket.IO handlers (minimal demo; replace with your full handlers if needed) ---
io.on('connection', (socket) => {
  socket.on('join', ({ name }) => {
    socket.join('lobby');
    io.to('lobby').emit('message', { from: 'system', text: `${name||'User'} joined` });
  });
  socket.on('message', ({ roomId, text }) => {
    io.to(roomId || 'lobby').emit('message', { from: 'user', text });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Server listening on', PORT);
});

process.on('unhandledRejection', err => console.error('unhandledRejection', err));
process.on('uncaughtException', err => console.error('uncaughtException', err));
process.on('SIGTERM', () => { console.log('Shutting down gracefully…'); server.close(() => process.exit(0)); });
