// Chat functionality

function initChat(socket) {
    console.log('Initializing chat handlers...');
    
    // Socket event handlers
    socket.on('room_created', (data) => {
        console.log('Room created:', data);
        window.currentRoomId = data.roomId;
        window.currentUsername = data.username;
        showToast(`Room created: ${window.currentRoomId}`, 'fa-solid fa-key');
        navigateTo('chat');
    });
    
    socket.on('room_joined', (data) => {
        console.log('Room joined:', data);
        window.currentRoomId = data.roomId;
        window.currentUsername = data.username;
        showToast(`Connected to ${data.roomId}`, 'fa-solid fa-check');
        navigateTo('chat');
    });
    
    socket.on('receive_message', (data) => {
        const isOwn = (data.username === window.currentUsername);
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
        if (data.username !== window.currentUsername) {
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
    
    socket.on('connected', (data) => {
        myUserId = data.userId;
        console.log('Connected with user ID:', myUserId);
    });
}

function enterRoom() {
    console.log('enterRoom called');
    const socket = getSocket();
    if (!socket) {
        showToast('Connecting to server...', 'fa-solid fa-spinner');
        setTimeout(() => enterRoom(), 500);
        return;
    }
    
    const username = document.getElementById('createUsername').value.trim();
    if (!username) {
        showToast('Please enter a username', 'fa-solid fa-user');
        document.getElementById('createUsername').focus();
        return;
    }
    
    const roomId = document.getElementById('generatedRoomId').textContent;
    if (roomId && roomId !== '------') {
        console.log('Creating room with ID:', roomId, 'username:', username);
        socket.emit('create_room_with_id', { roomId, username });
    } else {
        showToast('Generating room ID...', 'fa-solid fa-spinner');
        setTimeout(() => enterRoom(), 500);
    }
}

function joinRoom() {
    console.log('joinRoom called');
    const socket = getSocket();
    if (!socket) {
        showToast('Connecting to server...', 'fa-solid fa-spinner');
        setTimeout(() => joinRoom(), 500);
        return;
    }
    
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
    
    console.log('Joining room:', roomId, 'username:', username);
    socket.emit('join_room', { roomId, username });
}

function leaveRoom() {
    console.log('leaveRoom called');
    const socket = getSocket();
    if (socket && window.currentRoomId) {
        socket.emit('leave_room');
        window.currentRoomId = '';
        window.currentUsername = '';
        pendingFile = null;
        endCall();
    }
    
    // Hide call buttons
    const voiceBtn = document.getElementById('voiceCallBtn');
    const videoBtn = document.getElementById('videoCallBtn');
    if (voiceBtn) voiceBtn.style.display = 'none';
    if (videoBtn) videoBtn.style.display = 'none';
    
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
    if (!socket || !window.currentRoomId) return;
    
    socket.emit('typing', { isTyping: true });
    
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (socket) socket.emit('typing', { isTyping: false });
    }, 1000);
}

function updateUserCount(count) {
    const statusText = document.querySelector('.status-indicator span');
    if (statusText) {
        statusText.textContent = `${count} ${count === 1 ? 'user' : 'users'}`;
    }
}

function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Call integration
function startVoiceCall() {
    if (!window.currentRoomId) {
        showToast('Join a room first', 'fa-solid fa-exclamation-triangle');
        return;
    }
    showToast('Voice call feature - Select a user from the room', 'fa-solid fa-info-circle');
}

function startVideoCall() {
    if (!window.currentRoomId) {
        showToast('Join a room first', 'fa-solid fa-exclamation-triangle');
        return;
    }
    showToast('Video call feature - Select a user from the room', 'fa-solid fa-info-circle');
}

// Connect chat input handler
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', handleChatKeydown);
        chatInput.addEventListener('input', handleTyping);
    }
});
