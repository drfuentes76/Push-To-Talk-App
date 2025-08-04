// Client-side script with auto-detection for Render
const socket = io(window.location.origin);

const joinBtn = document.getElementById('joinBtn');
const nicknameInput = document.getElementById('nickname');
const chatUI = document.getElementById('chatUI');
const loginDiv = document.getElementById('login');
const pushToTalkBtn = document.getElementById('pushToTalkBtn');

let localStream;

joinBtn.addEventListener('click', () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return alert('Enter a nickname');
  socket.emit('join', nickname);
  loginDiv.style.display = 'none';
  chatUI.style.display = 'block';
});

pushToTalkBtn.addEventListener('mousedown', async () => {
  const chirp = document.getElementById('chirpSound');
  chirp.play();
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  // Audio streaming logic would go here
});

pushToTalkBtn.addEventListener('mouseup', () => {
  // Stop sending audio
});