// Main application entry point
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize socket
    socket = initSocket();
    
    // Initialize chat handlers
    initChat(socket);
    
    // Initialize call handlers
    initCallHandlers(socket);
    
    // Load version info
    loadVersionInfo();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('🔒 PRIVACY initialized');
});

function setupEventListeners() {
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const preview = document.getElementById('filePreviewOverlay');
            if (preview?.classList.contains('active')) {
                closePreview();
            } else if (!document.getElementById('homeScreen')?.classList.contains('active')) {
                navigateTo('home');
            }
        }
    });
    
    // Chat input handlers
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        chatInput.addEventListener('input', handleTyping);
    }
}

function navigateTo(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    switch (screen) {
        case 'home':
            document.getElementById('homeScreen').classList.add('active');
            if (socket && currentRoomId) {
                leaveRoom();
            }
            break;
        case 'createRoom':
            document.getElementById('createRoomScreen').classList.add('active');
            generateRoomId();
            break;
        case 'joinRoom':
            document.getElementById('joinRoomScreen').classList.add('active');
            document.getElementById('joinRoomInput').value = '';
            setTimeout(() => document.getElementById('joinRoomInput').focus(), 300);
            break;
        case 'chat':
            document.getElementById('chatScreen').classList.add('active');
            document.getElementById('chatRoomIdDisplay').textContent = currentRoomId;
            document.getElementById('chatInput').focus();
            clearChatMessages();
            addSystemMessage(`Connected to room ${currentRoomId} as @${currentUsername}`);
            addSystemMessage('Encryption active — channel is secure');
            
            // Show call buttons in topbar
            updateTopbarForChat();
            break;
    }
}

function updateTopbarForChat() {
    const topbarRight = document.querySelector('.topbar-right');
    if (topbarRight && !document.querySelector('.call-buttons')) {
        const callButtons = document.createElement('div');
        callButtons.className = 'call-buttons';
        callButtons.innerHTML = `
            <button class="call-btn" onclick="startVoiceCall()" title="Voice Call">
                <i class="fa-solid fa-phone"></i>
            </button>
            <button class="call-btn" onclick="startVideoCall()" title="Video Call">
                <i class="fa-solid fa-video"></i>
            </button>
        `;
        topbarRight.insertBefore(callButtons, topbarRight.firstChild);
    }
}

function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const length = Math.floor(Math.random() * 3) + 6;
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const display = document.getElementById('generatedRoomId');
    animateRoomId(display, id);
}

function animateRoomId(element, finalId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let iterations = 0;
    const maxIterations = 10;
    
    const interval = setInterval(() => {
        let scrambled = '';
        for (let i = 0; i < finalId.length; i++) {
            if (iterations > i * 1.5) {
                scrambled += finalId[i];
            } else {
                scrambled += chars[Math.floor(Math.random() * chars.length)];
            }
        }
        element.textContent = scrambled;
        iterations++;
        
        if (iterations > maxIterations) {
            clearInterval(interval);
            element.textContent = finalId;
        }
    }, 50);
}

// Make navigateTo global for onclick handlers
window.navigateTo = navigateTo;
window.generateRoomId = generateRoomId;
window.copyRoomId = copyRoomId;
window.copyChatRoomId = copyChatRoomId;