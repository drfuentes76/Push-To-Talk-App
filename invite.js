
function sendInvite() {
    const userToInvite = document.getElementById("inviteUserInput").value;
    if (userToInvite.trim()) {
        socket.emit("sendInvite", { to: userToInvite });
        logInteraction(`Invite sent to ${userToInvite}`);
    }
}

// Handle incoming invite
socket.on("receiveInvite", ({ from }) => {
    alert(`You have been invited to join a chat by ${from}`);
    logInteraction(`Received invite from ${from}`);
});
