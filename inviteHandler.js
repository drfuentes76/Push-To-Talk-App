
function setupInviteHandler(io, socket, users) {
    socket.on("sendInvite", ({ to }) => {
        const recipient = Object.values(users).find(user => user.username === to);
        if (recipient && recipient.socketId) {
            io.to(recipient.socketId).emit("receiveInvite", { from: users[socket.id].username });
        }
    });
}

module.exports = setupInviteHandler;
