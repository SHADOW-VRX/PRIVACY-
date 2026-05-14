// Socket.IO connection management
let socket = null;
let myUserId = null;

function initSocket() {
    console.log('Initializing Socket.IO connection...');
    socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', () => {
        console.log('🔒 Connected to secure server with ID:', socket.id);
        if (typeof showToast === 'function') {
            showToast('Secure channel established', 'fa-solid fa-shield');
        }
    });
    
    socket.on('connected', (data) => {
        myUserId = data.userId;
        console.log('User ID assigned:', myUserId);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        if (typeof showToast === 'function') {
            showToast('Connection lost - channel closed', 'fa-solid fa-plug');
        }
        if (document.getElementById('chatScreen')?.classList.contains('active')) {
            setTimeout(() => {
                if (typeof leaveRoom === 'function') leaveRoom();
            }, 2000);
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        if (typeof showToast === 'function') {
            showToast('Connection error. Retrying...', 'fa-solid fa-exclamation-triangle');
        }
    });
    
    // Initialize chat handlers after connection
    initChat(socket);
    initCallHandlers(socket);
    
    return socket;
}

function getSocket() {
    if (!socket) {
        return initSocket();
    }
    return socket;
}}

function getSocket() {
    if (!socket) {
        initSocket();
    }
    return socket;
}
