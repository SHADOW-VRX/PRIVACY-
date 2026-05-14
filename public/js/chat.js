// Chat functionality
let currentRoomId = '';
let currentUsername = '';
let pendingFile = null;
let typingTimeout = null;

function initChat(socket) {
    // Socket event handlers
    socket.on('room_created', (data) => {
        currentRoomId = data.roomId;
        currentUsername = data.username;
        showToast(`Room created: ${currentRoomId}`, 'fa-solid fa-key');
        navigateTo('chat');
    });
    
    socket.on('room_joined', (data) => {
        currentRoomId = data.roomId;
        currentUsername = data.username;
        showToast(`Connected to ${data.roomId}`, 'fa-solid fa-check');
        navigateTo('chat');
    });
    
    socket.on('receive_message', (data) => {
        const isOwn = (data.username === currentUsername);
        addMessage(data, isOwn);
    });
    
    socket.on('user_joined', (data) => {
        addSystemMessage(data.message);
        updateUserCount(data.userCount);
    });
    
    socket.on('user_left', (data) => {
        addSystemMessage(data.message);
        if (data.userCount !== undefined) {
            updateUserCount(data.userCount);
        }
    });
    
    socket.on('user_typing', (data) => {
        if (data.username !== currentUsername) {
            const typingElem = document.getElementById('typingUsername');
            if (typingElem) typingElem.textContent = data.username;
            showTypingIndicator();
            setTimeout(() => hideTypingIndicator(), 2000);
        }
    });
    
    socket.on('error', (data) => {
        showToast(data.error, 'fa-solid fa-triangle-exclamation');
        if (data.error.includes('not found') || data.error.includes('already exists')) {
            setTimeout(() => navigateTo('home'), 2000);
        }
    });
}

function enterRoom() {
    const socket = getSocket();
    const username = document.getElementById('createUsername').value.trim();
    if (!username) {
        showToast('Please enter a username', 'fa-solid fa-user');
        document.getElementById('createUsername').focus();
        return;
    }
    
    const roomId = document.getElementById('generatedRoomId').textContent;
    if (roomId && roomId !== '------') {
        socket.emit('create_room_with_id', { roomId, username });
    } else {
        showToast('Generating room ID...', 'fa-solid fa-spinner');
        setTimeout(() => enterRoom(), 500);
    }
}

function joinRoom() {
    const socket = getSocket();
    const username = document.getElementById('joinUsername').value.trim();
    if (!username) {
        showToast('Please enter a username', 'fa-solid fa-user');
        document.getElementById('joinUsername').focus();
        return;
    }
    
    const roomId = document.getElementById('joinRoomInput').value.trim().toUpperCase();
    if (!roomId) {
        showToast('Enter a Room ID', 'fa-solid fa-triangle-exclamation');
        document.getElementById('joinRoomInput').focus();
        return;
    }
    
    if (roomId.length < 6 || roomId.length > 8) {
        showToast('Room ID must be 6–8 characters', 'fa-solid fa-triangle-exclamation');
        document.getElementById('joinRoomInput').focus();
        return;
    }
    
    socket.emit('join_room', { roomId, username });
}

function leaveRoom() {
    const socket = getSocket();
    if (socket && currentRoomId) {
        socket.emit('leave_room');
        currentRoomId = '';
        currentUsername = '';
        pendingFile = null;
        endCall(); // End any active call
    }
    navigateTo('home');
}

function sendMessage() {
    const socket = getSocket();
    if (!socket) {
        showToast('Connecting to server...', 'fa-solid fa-spinner');
        return;
    }
    
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (pendingFile) {
        if (pendingFile.type === 'image') {
            socket.emit('send_message', {
                type: 'image',
                content: pendingFile.data,
                fileName: pendingFile.name,
                fileSize: pendingFile.size,
                fileType: 'image'
            });
        } else if (pendingFile.type === 'file' && pendingFile.fileObject) {
            const reader = new FileReader();
            reader.onload = (e) => {
                socket.emit('send_message', {
                    type: 'file',
                    content: e.target.result,
                    fileName: pendingFile.name,
                    fileSize: pendingFile.size,
                    fileType: pendingFile.fileObject.type
                });
            };
            reader.readAsDataURL(pendingFile.fileObject);
        }
        removeUploadPreview();
    }
    
    if (text) {
        socket.emit('send_message', {
            type: 'text',
            content: text
        });
    }
    
    input.value = '';
    input.focus();
}

function handleTyping() {
    const socket = getSocket();
    if (!socket || !currentRoomId) return;
    
    socket.emit('typing', { isTyping: true });
    
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (socket) socket.emit('typing', { isTyping: false });
    }, 1000);
}

// Call integration
function startVoiceCall() {
    if (!currentRoomId) {
        showToast('Join a room first', 'fa-solid fa-exclamation-triangle');
        return;
    }
    // Find other user in room (simplified - calls first available user)
    // In production, you'd want a user selection UI
    showToast('Select a user to call from the user list', 'fa-solid fa-info-circle');
}

function startVideoCall() {
    if (!currentRoomId) {
        showToast('Join a room first', 'fa-solid fa-exclamation-triangle');
        return;
    }
    showToast('Select a user to call from the user list', 'fa-solid fa-info-circle');
}

// Make functions global
window.enterRoom = enterRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.sendMessage = sendMessage;
window.startVoiceCall = startVoiceCall;
window.startVideoCall = startVideoCall;