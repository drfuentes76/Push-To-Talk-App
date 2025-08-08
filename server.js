const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.get('*', (_req, res)=> res.sendFile(path.join(__dirname,'index.html')));

const users = new Map(); // id -> {id,name,status,avatar}
const rooms = new Map(); // id -> {id,name,owner,members[],pinned}

function serializeUsers(){ return [...users.values()].map(u=>({id:u.id,name:u.name,status:u.status,avatar:u.avatar})); }
function serializeRooms(){ return [...rooms.values()].map(r=>({id:r.id,name:r.name,members:r.members.map(id=>users.get(id)).filter(Boolean),pinned:r.pinned})); }

io.on('connection',(socket)=>{
  socket.on('join', ({name,status,avatar})=>{
    const u={ id:socket.id, name:name||'Anonymous', status:status||'Online', avatar:avatar||null };
    users.set(socket.id, u);
    socket.join('lobby');
    socket.emit('joined',{ me:u });
    io.emit('user-joined',{ name:u.name });
    io.emit('update-user-list', serializeUsers());
    io.emit('room-list', serializeRooms());
  });

  socket.on('message', ({scope,roomId,text})=>{
    const u=users.get(socket.id); if(!u||!text) return;
    if(scope==='room' && roomId && rooms.get(roomId)) io.to(roomId).emit('message',{ from:u.name, text });
    else io.to('lobby').emit('message',{ from:u.name, text });
  });

  socket.on('typing', ({scope,roomId,typing})=>{
    const u=users.get(socket.id); if(!u||!typing) return;
    if(scope==='room' && roomId) io.to(roomId).emit('typing',{ name:u.name });
    else socket.to('lobby').emit('typing',{ name:u.name });
  });

  socket.on('voice', ({scope,roomId,data})=>{
    const u=users.get(socket.id); if(!u) return;
    const payload={ from:u.name, data };
    if(scope==='room' && roomId) io.to(roomId).emit('voice',payload); else io.to('lobby').emit('voice',payload);
  });
  socket.on('file', ({scope,roomId,name,data})=>{
    const u=users.get(socket.id); if(!u) return;
    const payload={ from:u.name, name, data };
    if(scope==='room' && roomId) io.to(roomId).emit('file',payload); else io.to('lobby').emit('file',payload);
  });
  socket.on('location', ({scope,roomId,lat,lon})=>{
    const u=users.get(socket.id); if(!u) return;
    const payload={ from:u.name, lat, lon };
    if(scope==='room' && roomId) io.to(roomId).emit('location',payload); else io.to('lobby').emit('location',payload);
  });

  socket.on('update-status', ({status})=>{
    const u=users.get(socket.id); if(!u) return;
    u.status = status || 'Online';
    io.emit('update-user-list', serializeUsers());
  });

  socket.on('create-room', ({name,memberIds=[],pinned=false})=>{
    const owner=socket.id;
    const id='room_'+Math.random().toString(36).slice(2,9);
    rooms.set(id,{ id, name, owner, members:[owner], pinned });
    socket.join(id); socket.leave('lobby');
    socket.emit('scope',{ type:'room', roomId:id, name });
    io.emit('room-list', serializeRooms());
    memberIds.forEach(mid=>{ const s=io.sockets.sockets.get(mid); if(s){ s.emit('invite',{ from: users.get(owner), room: rooms.get(id) }); } });
  });

  socket.on('invite-response', ({roomId,accept})=>{
    const r=rooms.get(roomId); const u=users.get(socket.id); if(!r||!u) return;
    if(accept){ if(!r.members.includes(socket.id)) r.members.push(socket.id); socket.join(roomId); socket.leave('lobby'); socket.emit('scope',{ type:'room', roomId, name:r.name }); io.emit('room-list', serializeRooms()); io.to(roomId).emit('message',{ from:'System', text:`${u.name} joined room`}); }
    else { socket.emit('message',{ from:'System', text:`Declined invite to ${r.name}`}); }
  });

  socket.on('switch-room', ({roomId})=>{
    const r=rooms.get(roomId); const u=users.get(socket.id); if(!r||!u) return;
    if(!r.members.includes(socket.id)) r.members.push(socket.id);
    for(const rid of socket.rooms){ if(rid!==socket.id) socket.leave(rid); }
    socket.join(roomId);
    socket.emit('scope',{ type:'room', roomId, name:r.name });
  });

  socket.on('disconnect', ()=>{
    const u=users.get(socket.id); users.delete(socket.id);
    for(const r of rooms.values()){
      r.members = r.members.filter(id=>id!==socket.id);
      if(r.owner===socket.id){
        if(r.pinned && r.members.length){ r.owner=r.members[0]; }
        else if(!r.pinned){ rooms.delete(r.id); }
      }
    }
    io.emit('update-user-list', serializeUsers());
    io.emit('room-list', serializeRooms());
    if(u) io.emit('user-left',{ name:u.name });
  });
});

server.listen(PORT, ()=> console.log('Server listening on', PORT));
