const socket = io("https://push-to-talk-app.onrender.com");

function log(msg) {
  const logBox = document.getElementById("statusLog");
  if (logBox) logBox.innerText = msg;
  console.log(msg);
}

document.addEventListener("DOMContentLoaded", () => {
  log("DOM Loaded");

  const joinBtn = document.getElementById('joinBtn');
  const nicknameInput = document.getElementById('nickname');
  const chatUI = document.getElementById('chatUI');
  const loginDiv = document.getElementById('login');

  joinBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) return alert('Enter a nickname');
    socket.emit('join', nickname);
    loginDiv.style.display = 'none';
    chatUI.style.display = 'block';
    log("Joined as " + nickname);
  });

  const bindButton = (id, label) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      log(`${label} button clicked`);
    });
  };

  bindButton("pushToTalkBtn", "Push to Talk");
  bindButton("recordVoiceNoteBtn", "Record Voice Note");
  bindButton("sendFileBtn", "Send File");
  bindButton("sendMediaBtn", "Send Media");
  bindButton("shareLocationBtn", "Share Location");
  bindButton("startVideoBtn", "Start Video");
  bindButton("emergencyTrackBtn", "Emergency Track");
  bindButton("dndToggleBtn", "Do Not Disturb");
  bindButton("createRoomBtn", "Create Room");
  bindButton("sendMsgBtn", "Send Message");
});

socket.on("connect", () => log("Connected to server"));
socket.on("disconnect", () => log("Disconnected from server"));
