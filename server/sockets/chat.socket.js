const crypto = require('crypto');
const roomService = require('../services/room.service');
const { sanitizeUsername, sanitizeMessage, validateRoomId } = require('../utils/sanitize');
const { isValidUsername, isValidMessage } = require('../utils/validators');
const { messageLimiter, typingLimiter, roomActionLimiter } = require('../middleware/rateLimiter');

module.exports = (io, socket) => {
  let currentRoomId = null;
  let currentUsername = null;
  let userId = crypto.randomBytes(4).toString('hex');

  // Send client their ID
  socket.emit('connected', { userId });

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
    
    socket.emit('room_created', {
      roomId,
      username: currentUsername,
      message: 'Secure room created successfully'
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
    
    socket.emit('room_created', {
      roomId,
      username: currentUsername,
      message: 'Secure room created successfully'
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
    
    currentUsername = username;
    roomService.addUserToRoom(roomId, socket.id, userId, currentUsername);
    currentRoomId = roomId;
    socket.join(roomId);
    
    socket.to(roomId).emit('user_joined', {
      userId,
      username: currentUsername,
      message: `${currentUsername} joined the channel`,
      userCount: roomService.getUserCount(roomId)
    });
    
    socket.emit('room_joined', {
      roomId,
      username: currentUsername,
      userCount: roomService.getUserCount(roomId),
      users: roomService.getRoomUsers(roomId).map(u => u.username),
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
        
        socket.to(currentRoomId).emit('user_left', {
          userId,
          username: leavingUsername,
          message: `${leavingUsername} left the channel`,
          userCount: roomService.getUserCount(currentRoomId) - 1
        });
        
        roomService.removeUserFromRoom(currentRoomId, socket.id);
        socket.leave(currentRoomId);
        
        console.log(`🚪 ${leavingUsername} (${socket.id}) left PRIVACY room: ${currentRoomId}`);
        
        roomService.destroyRoomIfEmpty(currentRoomId);
      }
      currentRoomId = null;
      currentUsername = null;
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    if (currentRoomId) {
      const room = roomService.getRoom(currentRoomId);
      if (room) {
        const userInfo = room.users.get(socket.id);
        const leavingUsername = userInfo ? userInfo.username : 'Anonymous';
        
        roomService.removeUserFromRoom(currentRoomId, socket.id);
        
        socket.to(currentRoomId).emit('user_left', {
          userId,
          username: leavingUsername,
          message: `${leavingUsername} disconnected`,
          userCount: roomService.getUserCount(currentRoomId)
        });
        
        console.log(`👋 ${leavingUsername} (${socket.id}) removed from PRIVACY room: ${currentRoomId}`);
        
        roomService.destroyRoomIfEmpty(currentRoomId);
      }
    }
    
    console.log(`📊 Active PRIVACY rooms: ${roomService.getActiveRoomsCount()}`);
  });

  return { currentRoomId, currentUsername, userId };
};
