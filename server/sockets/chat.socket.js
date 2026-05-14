const crypto = require('crypto');
const roomService = require('../services/room.service');
const { sanitizeUsername, sanitizeMessage, validateRoomId } = require('../utils/sanitize');
const { isValidUsername, isValidMessage } = require('../utils/validators');
const { messageLimiter, typingLimiter, roomActionLimiter } = require('../middleware/rateLimiter');

// Store socket to user mapping for reconnection
const socketToUser = new Map(); // socketId -> { roomId, username, userId }

// Helper function to broadcast user list to all users in a room
function broadcastUserList(io, roomId) {
    const room = roomService.getRoom(roomId);
    if (room) {
        const users = Array.from(room.users.values()).map(u => ({
            userId: u.userId,
            username: u.username,
            socketId: u.socketId
        }));
        io.to(roomId).emit('room_users_update', { users, userCount: users.length });
        console.log(`📊 Broadcasted user list to room ${roomId}: ${users.length} users`);
    }
}

// Helper function to notify user joined
function notifyUserJoined(io, roomId, newUser, userCount, users) {
    io.to(roomId).emit('user_joined', {
        userId: newUser.userId,
        username: newUser.username,
        message: `${newUser.username} joined the channel`,
        userCount: userCount,
        users: users
    });
}

module.exports = (io, socket) => {
    let currentRoomId = null;
    let currentUsername = null;
    let userId = crypto.randomBytes(4).toString('hex');

    // Send client their ID
    socket.emit('connected', { userId });
    console.log(`🔌 Client ${socket.id} connected with userId: ${userId}`);

    // Store mapping for reconnection
    socketToUser.set(socket.id, { roomId: null, username: null, userId });

    // Create room with custom ID
    socket.on('create_room_with_id', (data) => {
        if (!roomActionLimiter.isAllowed(socket.id, 'create_room')) {
            socket.emit('error', { error: 'Rate limit exceeded. Please wait before creating more rooms.' });
            return;
        }

        let { roomId, username } = data;
        
        if (!validateRoomId(roomId)) {
            socket.emit('error', { error: 'Invalid room ID format. Use only letters, numbers, underscore, hyphen.' });
            return;
        }
        
        username = sanitizeUsername(username);
        if (!isValidUsername(username)) {
            socket.emit('error', { error: 'Invalid username' });
            return;
        }
        
        if (roomService.roomExists(roomId)) {
            socket.emit('error', { error: 'Room ID already exists. Please regenerate.' });
            return;
        }
        
        currentUsername = username;
        roomService.createRoom(roomId, true);
        roomService.addUserToRoom(roomId, socket.id, userId, currentUsername);
        currentRoomId = roomId;
        socket.join(roomId);
        
        // Update mapping
        socketToUser.set(socket.id, { roomId: currentRoomId, username: currentUsername, userId });
        
        // Get current users
        const users = roomService.getRoomUsers(roomId).map(u => ({ userId: u.userId, username: u.username }));
        
        // Notify others about new user (none yet for new room)
        
        // Broadcast updated user list
        broadcastUserList(io, roomId);
        
        socket.emit('room_created', {
            roomId,
            username: currentUsername,
            message: 'Secure room created successfully',
            users: users
        });
        
        console.log(`✨ Room created with custom ID: ${roomId} by ${currentUsername} (${socket.id})`);
    });

    // Create room (auto-generate ID)
    socket.on('create_room', (data) => {
        if (!roomActionLimiter.isAllowed(socket.id, 'create_room')) {
            socket.emit('error', { error: 'Rate limit exceeded. Please wait before creating more rooms.' });
            return;
        }

        let { username } = data;
        username = sanitizeUsername(username);
        if (!isValidUsername(username)) {
            socket.emit('error', { error: 'Invalid username' });
            return;
        }
        
        const roomId = roomService.generateRoomId();
        currentUsername = username;
        roomService.createRoom(roomId);
        roomService.addUserToRoom(roomId, socket.id, userId, currentUsername);
        currentRoomId = roomId;
        socket.join(roomId);
        
        // Update mapping
        socketToUser.set(socket.id, { roomId: currentRoomId, username: currentUsername, userId });
        
        // Get current users
        const users = roomService.getRoomUsers(roomId).map(u => ({ userId: u.userId, username: u.username }));
        
        // Broadcast updated user list
        broadcastUserList(io, roomId);
        
        socket.emit('room_created', {
            roomId,
            username: currentUsername,
            message: 'Secure room created successfully',
            users: users
        });
        
        console.log(`✨ Room created (auto): ${roomId} by ${currentUsername} (${socket.id})`);
    });

    // Join room
    socket.on('join_room', (data) => {
        if (!roomActionLimiter.isAllowed(socket.id, 'join_room')) {
            socket.emit('error', { error: 'Rate limit exceeded. Please wait before joining more rooms.' });
            return;
        }

        let { roomId, username } = data;
        username = sanitizeUsername(username);
        
        if (!isValidUsername(username)) {
            socket.emit('error', { error: 'Invalid username' });
            return;
        }
        
        const room = roomService.getRoom(roomId);
        if (!room) {
            socket.emit('error', { error: 'Room not found or has been destroyed' });
            return;
        }
        
        // Check if user with same username already exists in room
        let existingUser = null;
        for (const [sid, userInfo] of room.users) {
            if (userInfo.username === username && sid !== socket.id) {
                existingUser = userInfo;
                break;
            }
        }
        
        if (existingUser) {
            socket.emit('error', { error: 'Username already taken in this room. Please choose another.' });
            return;
        }
        
        currentUsername = username;
        
        // If user was already in this room (reconnection), remove old entry first
        if (room.users.has(socket.id)) {
            roomService.removeUserFromRoom(roomId, socket.id);
        }
        
        roomService.addUserToRoom(roomId, socket.id, userId, currentUsername);
        currentRoomId = roomId;
        socket.join(roomId);
        
        // Update mapping
        socketToUser.set(socket.id, { roomId: currentRoomId, username: currentUsername, userId });
        
        // Get current users list (excluding the new user for notification)
        const existingUsers = roomService.getRoomUsers(roomId).filter(u => u.socketId !== socket.id);
        const allUsers = roomService.getRoomUsers(roomId).map(u => ({ userId: u.userId, username: u.username }));
        
        // Notify existing users about new user
        if (existingUsers.length > 0) {
            io.to(roomId).emit('user_joined', {
                userId: userId,
                username: currentUsername,
                message: `${currentUsername} joined the channel`,
                userCount: roomService.getUserCount(roomId),
                users: allUsers
            });
        }
        
        // Broadcast updated user list to everyone
        broadcastUserList(io, roomId);
        
        // Send confirmation to joining user with current user list
        socket.emit('room_joined', {
            roomId,
            username: currentUsername,
            userCount: roomService.getUserCount(roomId),
            users: allUsers,
            message: `Connected to secure channel: ${roomId}`
        });
        
        console.log(`🚪 ${currentUsername} (${socket.id}) joined PRIVACY room: ${roomId} (${roomService.getUserCount(roomId)} users)`);
    });

    // Send message
    socket.on('send_message', (data) => {
        if (!messageLimiter.isAllowed(socket.id, 'send_message')) {
            socket.emit('error', { error: 'Message rate limit exceeded. Please slow down.' });
            return;
        }

        if (!currentRoomId) {
            socket.emit('error', { error: 'Not in a room' });
            return;
        }
        
        const room = roomService.getRoom(currentRoomId);
        if (!room) {
            socket.emit('error', { error: 'Room no longer exists' });
            return;
        }
        
        const { type, content, fileName, fileSize, fileType } = data;
        const senderInfo = room.users.get(socket.id);
        const senderUsername = senderInfo ? senderInfo.username : 'Anonymous';
        
        let sanitizedContent = content;
        if (type === 'text') {
            sanitizedContent = sanitizeMessage(content);
            if (!isValidMessage(sanitizedContent)) {
                socket.emit('error', { error: 'Message is too long or invalid' });
                return;
            }
        }
        
        const messageData = {
            type,
            content: sanitizedContent,
            fileName: fileName ? sanitizeMessage(fileName) : null,
            fileSize,
            fileType,
            username: senderUsername,
            userId,
            timestamp: Date.now()
        };
        
        io.to(currentRoomId).emit('receive_message', messageData);
        console.log(`📨 Message in ${currentRoomId} from ${senderUsername}: ${type === 'text' ? sanitizedContent.substring(0, 50) : type}`);
    });

    // Typing indicator
    socket.on('typing', (data) => {
        if (!typingLimiter.isAllowed(socket.id, 'typing')) {
            return;
        }
        
        if (!currentRoomId) return;
        const room = roomService.getRoom(currentRoomId);
        if (!room) return;
        
        const senderInfo = room.users.get(socket.id);
        const senderUsername = senderInfo ? senderInfo.username : 'Anonymous';
        
        socket.to(currentRoomId).emit('user_typing', {
            username: senderUsername,
            isTyping: data.isTyping
        });
    });

    // Leave room
    socket.on('leave_room', () => {
        if (currentRoomId) {
            const room = roomService.getRoom(currentRoomId);
            if (room) {
                const userInfo = room.users.get(socket.id);
                const leavingUsername = userInfo ? userInfo.username : 'Anonymous';
                
                // Remove user from room
                roomService.removeUserFromRoom(currentRoomId, socket.id);
                
                // Get remaining users
                const remainingUsers = roomService.getRoomUsers(currentRoomId);
                const allUsers = remainingUsers.map(u => ({ userId: u.userId, username: u.username }));
                
                // Notify remaining users
                if (remainingUsers.length > 0) {
                    socket.to(currentRoomId).emit('user_left', {
                        userId,
                        username: leavingUsername,
                        message: `${leavingUsername} left the channel`,
                        userCount: roomService.getUserCount(currentRoomId),
                        users: allUsers
                    });
                    
                    // Broadcast updated user list
                    broadcastUserList(io, currentRoomId);
                }
                
                socket.leave(currentRoomId);
                
                // Update mapping
                socketToUser.set(socket.id, { roomId: null, username: null, userId });
                
                console.log(`🚪 ${leavingUsername} (${socket.id}) left PRIVACY room: ${currentRoomId}`);
                
                // Destroy room if empty
                const destroyed = roomService.destroyRoomIfEmpty(currentRoomId);
                if (destroyed) {
                    console.log(`💀 PRIVACY Room ${currentRoomId} self-destructed - no traces left`);
                }
            }
            currentRoomId = null;
            currentUsername = null;
        }
    });

    // Disconnect handler (auto-cleanup with reconnection support)
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        
        if (currentRoomId) {
            const room = roomService.getRoom(currentRoomId);
            if (room) {
                const userInfo = room.users.get(socket.id);
                const leavingUsername = userInfo ? userInfo.username : 'Anonymous';
                
                // Remove user from room
                roomService.removeUserFromRoom(currentRoomId, socket.id);
                
                // Get remaining users
                const remainingUsers = roomService.getRoomUsers(currentRoomId);
                const allUsers = remainingUsers.map(u => ({ userId: u.userId, username: u.username }));
                
                // Notify remaining users
                if (remainingUsers.length > 0) {
                    socket.to(currentRoomId).emit('user_left', {
                        userId,
                        username: leavingUsername,
                        message: `${leavingUsername} disconnected`,
                        userCount: roomService.getUserCount(currentRoomId),
                        users: allUsers
                    });
                    
                    // Broadcast updated user list
                    broadcastUserList(io, currentRoomId);
                }
                
                console.log(`👋 ${leavingUsername} (${socket.id}) removed from PRIVACY room: ${currentRoomId} (${roomService.getUserCount(currentRoomId)} users left)`);
                
                // Destroy room if empty
                const destroyed = roomService.destroyRoomIfEmpty(currentRoomId);
                if (destroyed) {
                    console.log(`💀 PRIVACY Room ${currentRoomId} auto-destroyed - zero traces remaining`);
                }
            }
            currentRoomId = null;
            currentUsername = null;
        }
        
        // Update mapping
        socketToUser.set(socket.id, { roomId: null, username: null, userId: null });
        
        console.log(`📊 Active PRIVACY rooms: ${roomService.getActiveRoomsCount()}`);
    });

    // Return the current state for use in call.socket.js
    return { 
        get currentRoomId() { return currentRoomId; },
        get currentUsername() { return currentUsername; },
        get userId() { return userId; }
    };
};