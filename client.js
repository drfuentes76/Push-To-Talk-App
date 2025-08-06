const socket = io();
let localStream;

function join() {
  const nickname = document.getElementById('nickname').value;
  if (nickname) {
    document.getElementById('controls').style.display = 'block';
    socket.emit('join', nickname);
  }
}

function pushToTalk() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream;
    const track = stream.getAudioTracks()[0];
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks);
      socket.emit('voice', blob);
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 2000);
  });
}

function recordVoiceNote() {
  pushToTalk();
}

function sendFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('file', { name: file.name, data: reader.result });
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

function shareLocation() {
  navigator.geolocation.getCurrentPosition(pos => {
    socket.emit('location', { lat: pos.coords.latitude, lon: pos.coords.longitude });
  });
}

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    document.body.appendChild(video);
  });
}

function emergencyTrack() {
  const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
  audio.play();
  shareLocation();
}

function toggleDND() {
  alert('DND toggled');
}

function sendMessage() {
  const msg = document.getElementById('message').value;
  socket.emit('message', msg);
  document.getElementById('message').value = '';
}

socket.on('message', msg => {
  const div = document.createElement('div');
  div.innerText = msg;
  document.getElementById('chat').appendChild(div);
});
