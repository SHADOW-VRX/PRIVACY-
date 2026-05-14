// Main application entry point
let socket = null;
let currentRoomId = '';
let currentUsername = '';
let pendingFile = null;
let typingTimeout = null;
let myUserId = null;

// Make variables global for other scripts to access
window.currentRoomId = currentRoomId;
window.currentUsername = currentUsername;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔒 DOM loaded, initializing PRIVACY...');
    
    // Initialize socket
    initSocket();
    
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
}

function navigateTo(screen) {
    console.log('Navigating to:', screen);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    switch (screen) {
        case 'home':
            document.getElementById('homeScreen').classList.add('active');
            if (socket && window.currentRoomId) {
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
            document.getElementById('chatRoomIdDisplay').textContent = window.currentRoomId;
            document.getElementById('chatInput').focus();
            clearChatMessages();
            addSystemMessage(`Connected to room ${window.currentRoomId} as @${window.currentUsername}`);
            addSystemMessage('Encryption active — channel is secure');
            
            // Show call buttons
            const voiceBtn = document.getElementById('voiceCallBtn');
            const videoBtn = document.getElementById('videoCallBtn');
            if (voiceBtn) voiceBtn.style.display = 'flex';
            if (videoBtn) videoBtn.style.display = 'flex';
            break;
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
    if (display) {
        animateRoomId(display, id);
    }
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

function copyRoomId() {
    const roomId = document.getElementById('generatedRoomId')?.textContent;
    if (roomId && roomId !== '------') {
        copyToClipboard(roomId);
    }
}

function copyChatRoomId() {
    copyToClipboard(window.currentRoomId);
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard', 'fa-solid fa-check');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copied to clipboard', 'fa-solid fa-check');
}

function clearChatMessages() {
    const container = document.getElementById('chatMessages');
    if (container) {
        container.innerHTML = `
            <div class="empty-state" id="emptyState">
                <div class="empty-state-icon"><i class="fa-solid fa-satellite-dish"></i></div>
                <div class="empty-state-text">
                    No transmissions yet...<span class="blink-underscore">_</span><br>
                    <span style="font-size: 0.7rem; margin-top: 4px; display: inline-block;">
                        Waiting for signals on this channel
                    </span>
                </div>
            </div>
        `;
    }
}

function hideEmptyState() {
    const empty = document.getElementById('emptyState');
    if (empty) empty.remove();
}

function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function addSystemMessage(text) {
    hideEmptyState();
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const msg = document.createElement('div');
    msg.className = 'system-message';
    msg.innerHTML = `<span>[ ${escapeHtml(text)} ]</span>`;
    container.appendChild(msg);
    scrollToBottom();
}

function addMessage(data, isOwn) {
    hideEmptyState();
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isOwn ? 'own' : 'other'}`;
    
    const time = getTimestamp();
    let contentHtml = '';
    
    if (data.type === 'text') {
        contentHtml = `
            <div class="message-bubble">
                <div class="message-username">${escapeHtml(data.username)}</div>
                <div class="message-text">${escapeHtml(data.content)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    } else if (data.type === 'image') {
        contentHtml = `
            <div class="message-bubble">
                <div class="message-username">${escapeHtml(data.username)}</div>
                <div class="message-text">📷 sent an image</div>
                <div class="message-image" onclick="openImagePreview('${data.content.replace(/'/g, "\\'")}')">
                    <img src="${data.content}" alt="Shared image">
                </div>
                <div class="message-time">${time}</div>
            </div>
        `;
    } else if (data.type === 'file') {
        contentHtml = `
            <div class="message-bubble">
                <div class="message-username">${escapeHtml(data.username)}</div>
                <div class="message-text">📎 sent a file</div>
                <div class="message-file" onclick="showToast('File: ${escapeHtml(data.fileName)}', 'fa-solid fa-download')">
                    <span class="file-icon"><i class="fa-solid fa-file"></i></span>
                    <div class="file-info">
                        <span class="file-name">${escapeHtml(data.fileName)}</span>
                        <span class="file-size">${data.fileSize || 'Unknown size'}</span>
                    </div>
                </div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    
    wrapper.innerHTML = contentHtml;
    container.appendChild(wrapper);
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, icon = 'fa-solid fa-circle-info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="${icon}"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.classList.add('active');
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.classList.remove('active');
}

function openImagePreview(src) {
    const previewImg = document.getElementById('previewImage');
    const overlay = document.getElementById('filePreviewOverlay');
    if (previewImg && overlay) {
        previewImg.src = src;
        overlay.classList.add('active');
    }
}

function closePreview() {
    const overlay = document.getElementById('filePreviewOverlay');
    if (overlay) overlay.classList.remove('active');
}

function removeUploadPreview() {
    pendingFile = null;
    const preview = document.getElementById('imageUploadPreview');
    if (preview) preview.classList.remove('active');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const isImage = file.type.startsWith('image/');
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const sizeStr = sizeMB < 1 ? `${(file.size / 1024).toFixed(1)} KB` : `${sizeMB} MB`;
    
    if (isImage) {
        const reader = new FileReader();
        reader.onload = function(e) {
            pendingFile = {
                type: 'image',
                data: e.target.result,
                name: file.name,
                size: sizeStr,
                fileObject: file
            };
            showUploadPreview(e.target.result, file.name);
        };
        reader.readAsDataURL(file);
    } else {
        pendingFile = {
            type: 'file',
            name: file.name,
            size: sizeStr,
            fileObject: file
        };
        showUploadPreview(null, file.name);
    }
    
    event.target.value = '';
}

function showUploadPreview(imageSrc, fileName) {
    const preview = document.getElementById('imageUploadPreview');
    const thumb = document.getElementById('previewThumb');
    const nameEl = document.getElementById('previewFileName');
    
    if (preview && thumb && nameEl) {
        if (imageSrc) {
            thumb.src = imageSrc;
            thumb.style.display = 'block';
        } else {
            thumb.style.display = 'none';
        }
        nameEl.textContent = fileName;
        preview.classList.add('active');
    }
}

function loadVersionInfo() {
    fetch('/api/version')
        .then(res => res.json())
        .then(data => {
            console.log(`🔒 PRIVACY v${data.version} | ${data.environment}`);
        })
        .catch(err => console.log('Version check failed:', err));
}

// Make all functions globally available
window.navigateTo = navigateTo;
window.generateRoomId = generateRoomId;
window.copyRoomId = copyRoomId;
window.copyChatRoomId = copyChatRoomId;
window.enterRoom = enterRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.sendMessage = sendMessage;
window.handleTyping = handleTyping;
window.handleFileSelect = handleFileSelect;
window.removeUploadPreview = removeUploadPreview;
window.openImagePreview = openImagePreview;
window.closePreview = closePreview;
window.showToast = showToast;
window.startVoiceCall = startVoiceCall;
window.startVideoCall = startVideoCall;
window.toggleMute = toggleMute;
window.toggleVideo = toggleVideo;
window.endCall = endCall;
window.acceptCall = acceptCall;
