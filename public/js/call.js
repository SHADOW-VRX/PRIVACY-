// WebRTC Voice/Video Call Implementation
let peerConnection = null;
let localStream = null;
let currentCallType = null;
let currentCallTarget = null;
let callActive = false;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function initCallHandlers(socket) {
    // Incoming call
    socket.on('incoming_call', async (data) => {
        showIncomingCallToast(data);
    });
    
    // Call answer
    socket.on('call_answer', async (data) => {
        if (peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        }
    });
    
    // ICE candidate
    socket.on('ice_candidate', async (data) => {
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    });
    
    // Call rejected
    socket.on('call_rejected', (data) => {
        hideCallModal();
        if (typeof showToast === 'function') {
            showToast(`${data.byUsername} rejected the call`, 'fa-solid fa-phone-slash');
        }
        endCall();
    });
    
    // Call ended by other party
    socket.on('call_ended', () => {
        hideCallModal();
        if (typeof showToast === 'function') {
            showToast('Call ended by the other party', 'fa-solid fa-phone-slash');
        }
        endCall();
    });
}

async function startCall(targetUserId, callType) {
    currentCallType = callType;
    currentCallTarget = targetUserId;
    
    try {
        const constraints = callType === 'video' 
            ? { audio: true, video: true }
            : { audio: true, video: false };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (callType === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) localVideo.srcObject = localStream;
            showCallModal(true);
        } else {
            showCallModal(false);
        }
        
        peerConnection = new RTCPeerConnection(configuration);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
            }
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    targetUserId: currentCallTarget,
                    candidate: event.candidate
                });
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'disconnected' ||
                peerConnection.iceConnectionState === 'failed' ||
                peerConnection.iceConnectionState === 'closed') {
                endCall();
            }
        };
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('call_offer', {
            targetUserId: currentCallTarget,
            offer: peerConnection.localDescription,
            callType: currentCallType
        });
        
        callActive = true;
        updateCallStatus('Calling...');
        
    } catch (error) {
        console.error('Error starting call:', error);
        if (error.name === 'NotAllowedError') {
            if (typeof showToast === 'function') {
                showToast('Microphone/Camera access denied. Please check permissions.', 'fa-solid fa-exclamation-triangle');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('Failed to start call', 'fa-solid fa-exclamation-triangle');
            }
        }
    }
}

async function acceptCall(data, callType) {
    currentCallType = callType;
    currentCallTarget = data.fromUserId;
    hideIncomingCallToast();
    
    try {
        const constraints = callType === 'video'
            ? { audio: true, video: true }
            : { audio: true, video: false };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (callType === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) localVideo.srcObject = localStream;
            showCallModal(true);
        } else {
            showCallModal(false);
        }
        
        peerConnection = new RTCPeerConnection(configuration);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
            }
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    targetUserId: currentCallTarget,
                    candidate: event.candidate
                });
            }
        };
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('call_answer', {
            fromUserId: data.fromUserId,
            answer: peerConnection.localDescription
        });
        
        callActive = true;
        updateCallStatus('Connected');
        
    } catch (error) {
        console.error('Error accepting call:', error);
        if (typeof showToast === 'function') {
            showToast('Failed to accept call', 'fa-solid fa-exclamation-triangle');
        }
        endCall();
    }
}

function rejectCall(fromUserId) {
    socket.emit('call_rejected', { fromUserId });
    hideIncomingCallToast();
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (callActive) {
        socket.emit('call_ended');
        callActive = false;
    }
    
    currentCallType = null;
    currentCallTarget = null;
    
    hideCallModal();
    hideIncomingCallToast();
    
    // Reset video elements
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
}

function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const muteBtn = document.getElementById('muteBtn');
            if (muteBtn) {
                if (!audioTrack.enabled) {
                    muteBtn.classList.add('muted');
                    muteBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
                } else {
                    muteBtn.classList.remove('muted');
                    muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                }
            }
        }
    }
}

function toggleVideo() {
    if (localStream && currentCallType === 'video') {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const videoBtn = document.getElementById('videoBtn');
            if (videoBtn) {
                if (!videoTrack.enabled) {
                    videoBtn.classList.add('muted');
                    videoBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
                } else {
                    videoBtn.classList.remove('muted');
                    videoBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
                }
            }
        }
    }
}

function showCallModal(showVideo) {
    const modal = document.getElementById('callModal');
    const videoContainer = document.getElementById('callVideoContainer');
    
    if (modal) {
        if (showVideo) {
            if (videoContainer) videoContainer.style.display = 'flex';
        } else {
            if (videoContainer) videoContainer.style.display = 'none';
        }
        modal.classList.add('active');
    }
}

function hideCallModal() {
    const modal = document.getElementById('callModal');
    if (modal) modal.classList.remove('active');
}

function showIncomingCallToast(data) {
    // Remove existing toast
    hideIncomingCallToast();
    
    const toast = document.createElement('div');
    toast.className = 'incoming-call-toast';
    toast.id = 'incomingCallToast';
    toast.innerHTML = `
        <div style="text-align: center;">
            <i class="fa-solid fa-phone-ring" style="font-size: 1.5rem; color: var(--accent-primary);"></i>
            <div style="margin-top: 8px;"><strong>${escapeHtml(data.fromUsername)}</strong> is calling...</div>
            <div style="font-size: 0.7rem; color: var(--text-dim);">${data.callType === 'video' ? '📹 Video Call' : '🎙️ Voice Call'}</div>
        </div>
        <div class="call-actions">
            <button class="call-control-btn" onclick="window.acceptCallFromGlobals('${data.fromUserId}', '${data.callType}')">
                <i class="fa-solid fa-phone"></i> Accept
            </button>
            <button class="call-control-btn" onclick="window.rejectCallFromGlobals('${data.fromUserId}')">
                <i class="fa-solid fa-phone-slash"></i> Reject
            </button>
        </div>
    `;
    document.body.appendChild(toast);
}

function hideIncomingCallToast() {
    const toast = document.getElementById('incomingCallToast');
    if (toast) toast.remove();
}

function updateCallStatus(status) {
    const statusElem = document.getElementById('callStatus');
    if (statusElem) statusElem.textContent = status;
}

// Global functions for call buttons
window.acceptCallFromGlobals = function(userId, callType) {
    // This will be set from chat.js
    if (typeof window.acceptCall === 'function') {
        window.acceptCall(userId, callType);
    }
};

window.rejectCallFromGlobals = function(userId) {
    rejectCall(userId);
};