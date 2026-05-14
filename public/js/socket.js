// Socket.IO connection management
let socket = null;
let myUserId = null;

function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('🔒 Connected to secure server');
        if (typeof showToast === 'function') {
            showToast('Secure channel established', 'fa-solid fa-shield');
        }
    });
    
    socket.on('connected', (data) => {
        myUserId = data.userId;
    });
    
    socket.on('disconnect', () => {
        if (typeof showToast === 'function') {
            showToast('Connection lost - channel closed', 'fa-solid fa-plug');
        }
        if (document.getElementById('chatScreen')?.classList.contains('active')) {
            setTimeout(() => {
                if (typeof leaveRoom === 'function') leaveRoom();
            }, 2000);
        }
    });
    
    return socket;
}

function getSocket() {
    if (!socket) {
        initSocket();
    }
    return socket;
}