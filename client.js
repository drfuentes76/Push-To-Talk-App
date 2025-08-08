const socket = io();
let me = { id:null, name:null, status:"Online", avatar:null };
let scope = { type:"lobby", roomId:null };

const joinPanel=document.getElementById("joinPanel");
const appPanel=document.getElementById("appPanel");
const joinForm=document.getElementById("joinForm");
const nickname=document.getElementById("nickname");
const statusSel=document.getElementById("statusSel");
const avatarInp=document.getElementById("avatar");
const highContrast=document.getElementById("highContrast");

const userList=document.getElementById("userList");
const roomList=document.getElementById("roomList");
const logEl=document.getElementById("log");
const msgInput=document.getElementById("msgInput");
const sendBtn=document.getElementById("sendBtn");
const typingEl=document.getElementById("typing");
const scopeBadge=document.getElementById("scopeBadge");
const createRoomBtn=document.getElementById("createRoomBtn");

const inviteDlg=document.getElementById("inviteDlg");
const inviteList=document.getElementById("inviteList");
const roomName=document.getElementById("roomName");
const pinRoom=document.getElementById("pinRoom");

const toneJoin=document.getElementById("toneJoin");
const toneLeave=document.getElementById("toneLeave");
const toneMsg=document.getElementById("toneMsg");
const toneFile=document.getElementById("toneFile");
const tonePTT=document.getElementById("tonePTT");

function play(t){ try{ t.currentTime=0; t.play(); }catch(e){} }
function speak(text){ try{ speechSynthesis.speak(new SpeechSynthesisUtterance(text)); }catch(e){} }
function notify(title, body){ if(Notification.permission==='granted'){ new Notification(title,{body}); } }
function addLog(text){ const d=document.createElement('div'); d.className='entry'; d.textContent=text; logEl.appendChild(d); logEl.scrollTop=logEl.scrollHeight; speak(text); }

highContrast.addEventListener("change", ()=> document.documentElement.classList.toggle("high-contrast", highContrast.checked));

joinForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(Notification && Notification.permission!=='granted'){ try{ await Notification.requestPermission(); }catch{} }
  me.name=nickname.value.trim();
  me.status=statusSel.value;
  if(!me.name) return;
  if(avatarInp.files[0]) me.avatar = await fileToBase64(avatarInp.files[0]);
  socket.emit("join", { name: me.name, status: me.status, avatar: me.avatar });
});
function fileToBase64(f){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); }); }

sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", (e)=>{ socket.emit("typing", { scope: scope.type, roomId: scope.roomId, typing:true }); if(e.key==='Enter'){ e.preventDefault(); sendMessage(); } });
function sendMessage(){ const text=msgInput.value.trim(); if(!text) return; socket.emit("message",{ scope: scope.type, roomId: scope.roomId, text }); msgInput.value=''; }

// Minimal PTT (short voice note on hold)
let mediaRecorder=null, chunks=[];
const pttBtn=document.getElementById("pttBtn");
pttBtn.addEventListener("mousedown", startRec); pttBtn.addEventListener("touchstart", startRec);
pttBtn.addEventListener("mouseup", stopRec);  pttBtn.addEventListener("touchend", stopRec);
async function startRec(){ play(tonePTT); const s=await navigator.mediaDevices.getUserMedia({audio:true}); mediaRecorder=new MediaRecorder(s); chunks=[]; mediaRecorder.ondataavailable=e=>chunks.push(e.data); mediaRecorder.onstop=async()=>{ const blob=new Blob(chunks,{type:'audio/webm'}); const arr=Array.from(new Uint8Array(await blob.arrayBuffer())); socket.emit('voice',{ scope: scope.type, roomId: scope.roomId, data: arr }); }; mediaRecorder.start(); }
function stopRec(){ if(mediaRecorder && mediaRecorder.state!=='inactive'){ mediaRecorder.stop(); } }

document.getElementById("fileBtn").addEventListener("click", ()=>{ const i=document.createElement('input'); i.type='file'; i.onchange=async()=>{ const f=i.files[0]; if(!f) return; const buf=await f.arrayBuffer(); socket.emit('file',{ scope: scope.type, roomId: scope.roomId, name:f.name, data:Array.from(new Uint8Array(buf)) }); }; i.click(); });
document.getElementById("locationBtn").addEventListener("click", ()=>{ navigator.geolocation.getCurrentPosition(pos=>{ socket.emit('location',{ scope: scope.type, roomId: scope.roomId, lat:pos.coords.latitude, lon:pos.coords.longitude }); }); });
document.getElementById("dndBtn").addEventListener("click", ()=>{ me.status = me.status==='DND' ? 'Online':'DND'; socket.emit('update-status',{ status: me.status }); });

createRoomBtn.addEventListener("click", ()=>{
  inviteList.innerHTML='';
  [...userList.querySelectorAll('li[data-id]')].forEach(li=>{ const id=li.getAttribute('data-id'); if(id===socket.id) return; const lab=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.value=id; const span=document.createElement('span'); span.textContent=li.querySelector('.name').textContent; lab.append(cb,span); inviteList.append(lab); });
  inviteDlg.showModal();
});
document.getElementById("inviteSend").addEventListener("click",(e)=>{ e.preventDefault(); const name=roomName.value.trim(); if(!name) return; const ids=[...inviteList.querySelectorAll('input:checked')].map(x=>x.value); socket.emit('create-room',{ name, memberIds: ids, pinned: pinRoom.checked }); inviteDlg.close(); roomName.value=''; pinRoom.checked=false; });

// Socket events
socket.on('connect', ()=>{ me.id=socket.id; });
socket.on('joined', ({me:info})=>{ Object.assign(me,info); joinPanel.hidden=true; appPanel.hidden=false; addLog(`Joined as ${me.name} (${me.status})`); });
socket.on('update-user-list', (users)=>{ userList.innerHTML=''; users.forEach(u=>{ const li=document.createElement('li'); li.dataset.id=u.id; const dot=document.createElement('span'); dot.className='dot'; dot.style.background = u.status==='DND' ? '#ef4444' : '#22c55e'; const img=document.createElement('img'); img.src=u.avatar || 'https://avatars.githubusercontent.com/u/9919?s=64&v=4'; img.alt=`${u.name} avatar`; const nm=document.createElement('span'); nm.className='name'; nm.textContent=u.name; const st=document.createElement('span'); st.textContent=` — ${u.status}`; li.append(dot,img,nm,st); userList.append(li); }); });
socket.on('room-list', (rooms)=>{ roomList.innerHTML=''; rooms.forEach(r=>{ const li=document.createElement('li'); li.textContent=`${r.name} (${r.members.length})${r.pinned?' 📌':''}`; li.tabIndex=0; li.addEventListener('click',()=> socket.emit('switch-room',{ roomId:r.id })); roomList.append(li); }); });
socket.on('invite', ({from, room})=>{ notify('Room invite', `${from.name} invited you to ${room.name}`); const ok = confirm(`${from.name} invited you to “${room.name}”. Accept?`); socket.emit('invite-response',{ roomId: room.id, accept: ok }); });
socket.on('scope', (s)=>{ scope=s; scopeBadge.textContent = s.type==='lobby' ? 'Lobby' : `Room: ${s.name}`; addLog(`Switched to ${scopeBadge.textContent}`); });
socket.on('user-joined', ({name})=>{ addLog(`${name} joined`); play(toneJoin); });
socket.on('user-left', ({name})=>{ addLog(`${name} left`); play(toneLeave); });
socket.on('message', ({from, text})=>{ addLog(`${from}: ${text}`); play(toneMsg); notify(`Message from ${from}`, text); });
socket.on('typing', ({name})=>{ typingEl.hidden=false; typingEl.textContent=`${name} is typing…`; setTimeout(()=> typingEl.hidden=true,1200); });
socket.on('voice', ({from, data})=>{ addLog(`${from} sent a voice clip`); const a=document.createElement('audio'); a.controls=true; const blob=new Blob([new Uint8Array(data)],{type:'audio/webm'}); a.src=URL.createObjectURL(blob); logEl.appendChild(a); play(toneMsg); });
socket.on('file', ({from, name})=>{ addLog(`${from} sent file “${name}”`); play(toneFile); });
socket.on('location', ({from, lat, lon})=>{ addLog(`${from} location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`); });
