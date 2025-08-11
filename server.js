// server.js — Render-safe full app (PTT, voice memos, files, rooms, VC, emergency, location)
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, path: '/socket.io', maxHttpBufferSize: 2e8 });
const PORT = process.env.PORT || 3000;

app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.use(express.static(__dirname));
app.get('/room/:id', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- State (in-memory) ---
const users = new Map();
const rooms = new Map();
const vcRooms = new Map();

const serializeUsers = () => [...users.values()].map(u => ({ id:u.id, name:u.name, status:u.status, avatar:u.avatar }));
const serializeRooms = () => [...rooms.values()].map(r => ({ id:r.id, name:r.name, members:r.members, pinned:r.pinned }));
const scopeRoom = (roomId)=> roomId || 'lobby';

io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  socket.on('join', ({ name, status, avatar }) => {
    const u = { id: socket.id, name: name || 'Anonymous', status: status || 'Online', avatar: avatar || null, ip };
    users.set(socket.id, u);
    socket.join('lobby');
    socket.emit('joined', { me: u });
    io.emit('update-user-list', serializeUsers());
    io.emit('room-list', serializeRooms());
    const vc = vcRooms.get(null);
    if (vc?.active) socket.emit('vc-present', { roomId: null, peers: [...io.sockets.sockets.keys()].filter(id => id !== socket.id) });
  });

  socket.on('message', ({ roomId, text }) => {
    const u = users.get(socket.id); if (!u || !text) return;
    io.to(scopeRoom(roomId)).emit('message', { from: u.name, text });
  });

  // ---- Files (chunked) ----
  socket.on('file-meta', ({ roomId, name, size, fileId }) => {
    const u = users.get(socket.id); if (!u) return;
    io.to(scopeRoom(roomId)).emit('file-meta', { from: u.name, name, size, fileId });
  });
  socket.on('file-chunk', ({ roomId, fileId, seq, chunk }) => {
    io.to(scopeRoom(roomId)).emit('file-chunk', { fileId, seq, chunk });
  });
  socket.on('file-complete', ({ roomId, fileId }) => {
    io.to(scopeRoom(roomId)).emit('file-complete', { fileId });
  });

  // ---- Voice memo ----
  socket.on('voice-memo', ({ roomId, data, mime }) => {
    const u = users.get(socket.id); if (!u) return;
    io.to(scopeRoom(roomId)).emit('voice-memo', { from: u.name, data, mime: mime || 'audio/webm' });
  });

  // ---- Live Push‑to‑Talk ----
  socket.on('ptt-start', ({ roomId }) => {
    const u = users.get(socket.id); if (!u) return;
    io.to(scopeRoom(roomId)).emit('ptt-indicator', { from: u.name, action: 'start' });
  });
  socket.on('ptt-chunk', ({ roomId, seq, data, mime }) => {
    io.to(scopeRoom(roomId)).emit('ptt-chunk', { seq, data, mime: mime || 'audio/webm' });
  });
  socket.on('ptt-stop', ({ roomId }) => {
    const u = users.get(socket.id); if (!u) return;
    io.to(scopeRoom(roomId)).emit('ptt-indicator', { from: u.name, action: 'stop' });
  });

  // ---- Location & Emergency ----
  socket.on('location', ({ roomId, lat, lon }) => {
    const u = users.get(socket.id); if (!u) return;
    io.to(scopeRoom(roomId)).emit('location', { from: u.name, lat, lon });
  });
  socket.on('emergency-stream', ({ roomId=null, action, meta }) => {
    io.to(scopeRoom(roomId)).emit('emergency-signal', { from: users.get(socket.id), action, meta });
  });

  // ---- Rooms + invites ----
  socket.on('create-room', ({ name, memberIds = [], pinned = true }) => {
    const id = 'room_' + Math.random().toString(36).slice(2, 9);
    rooms.set(id, { id, name: name || 'Room', owner: socket.id, members: [socket.id], pinned });
    socket.join(id); socket.leave('lobby');
    socket.emit('scope', { type: 'room', roomId: id, name: rooms.get(id).name, url: `/room/${id}` });
    io.emit('room-list', serializeRooms());
    memberIds.forEach((mid) => { const s = io.sockets.sockets.get(mid); if (s) s.emit('invite', { from: users.get(socket.id), room: rooms.get(id) }); });
  });
  socket.on('invite-response', ({ roomId, accept }) => {
    const r = rooms.get(roomId); if (!r) return;
    if (accept) { if (!r.members.includes(socket.id)) r.members.push(socket.id); socket.join(roomId); socket.leave('lobby'); socket.emit('scope', { type: 'room', roomId, name: r.name, url: `/room/${roomId}` }); io.emit('room-list', serializeRooms()); }
  });
  socket.on('switch-room', ({ roomId }) => {
    if (!roomId) { for (const rid of socket.rooms) if (rid !== socket.id) socket.leave(rid); socket.join('lobby'); socket.emit('scope', { type: 'lobby', roomId: null, name: null, url: '/' }); return; }
    const r = rooms.get(roomId); if (!r) return; if (!r.members.includes(socket.id)) r.members.push(socket.id);
    for (const rid of socket.rooms) if (rid !== socket.id) socket.leave(rid);
    socket.join(roomId); socket.emit('scope', { type: 'room', roomId, name: r.name, url: `/room/${roomId}` });
  });

  // ---- Video conference signaling ----
  socket.on('vc-start', ({ roomId=null }) => {
    const members = roomId ? (rooms.get(roomId)?.members || []) : [...io.sockets.sockets.keys()];
    const peers = members.filter(id => id !== socket.id);
    io.to(scopeRoom(roomId)).emit('vc-started', { starterId: socket.id, roomId, members: peers });
  });
  socket.on('vc-stop', ({ roomId=null }) => {
    io.to(scopeRoom(roomId)).emit('vc-stopped', { starterId: socket.id, roomId });
  });
  socket.on('signal', ({ to, data }) => { if (io.sockets.sockets.get(to)) io.to(to).emit('signal', { from: socket.id, data }); });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    for (const r of rooms.values()) r.members = r.members.filter(id => id !== socket.id);
    io.emit('update-user-list', serializeUsers());
    io.emit('room-list', serializeRooms());
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('✅ Server listening on', PORT));
process.on('unhandledRejection', (err) => console.error('unhandledRejection', err));
process.on('uncaughtException', (err) => console.error('uncaughtException', err));
process.on('SIGTERM', () => { console.log('Shutting down gracefully…'); server.close(() => process.exit(0)); });
