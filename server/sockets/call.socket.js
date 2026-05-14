const { callLimiter } = require('../middleware/rateLimiter');
const roomService = require('../services/room.service');

// Store active calls per room
const activeCalls = new Map(); // roomId -> { callerId, calleeId, type }

module.exports = (io, socket, chatState) => {
  const getCurrentRoom = () => chatState.currentRoomId;
  const getCurrentUsername = () => chatState.currentUsername;

  // Call offer
  socket.on('call_offer', (data) => {
    if (!callLimiter.isAllowed(socket.id, 'call_offer')) {
      socket.emit('call_error', { error: 'Call rate limit exceeded. Please wait.' });
      return;
    }

    const { targetUserId, offer, callType } = data;
    const roomId = getCurrentRoom();
    
    if (!roomId) {
      socket.emit('call_error', { error: 'Not in a room' });
      return;
    }
    
    const room = roomService.getRoom(roomId);
    if (!room) {
      socket.emit('call_error', { error: 'Room no longer exists' });
      return;
    }
    
    // Find target socket
    let targetSocketId = null;
    let targetUsername = null;
    for (const [socketId, userInfo] of room.users) {
      if (userInfo.userId === targetUserId) {
        targetSocketId = socketId;
        targetUsername = userInfo.username;
        break;
      }
    }
    
    if (!targetSocketId) {
      socket.emit('call_error', { error: 'User no longer in room' });
      return;
    }
    
    // Store active call
    activeCalls.set(roomId, {
      callerId: socket.id,
      calleeId: targetSocketId,
      callerUserId: chatState.userId,
      calleeUserId: targetUserId,
      callerUsername: getCurrentUsername(),
      calleeUsername: targetUsername,
      type: callType,
      active: true
    });
    
    io.to(targetSocketId).emit('incoming_call', {
      fromUserId: chatState.userId,
      fromUsername: getCurrentUsername(),
      offer,
      callType
    });
    
    console.log(`📞 Call offer from ${getCurrentUsername()} to ${targetUsername} in ${roomId} (${callType})`);
  });

  // Call answer
  socket.on('call_answer', (data) => {
    const { fromUserId, answer } = data;
    const roomId = getCurrentRoom();
    
    if (!roomId) return;
    
    const room = roomService.getRoom(roomId);
    if (!room) return;
    
    // Find caller socket
    let callerSocketId = null;
    for (const [socketId, userInfo] of room.users) {
      if (userInfo.userId === fromUserId) {
        callerSocketId = socketId;
        break;
      }
    }
    
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_answer', { answer });
    }
  });

  // ICE candidate
  socket.on('ice_candidate', (data) => {
    const { targetUserId, candidate } = data;
    const roomId = getCurrentRoom();
    
    if (!roomId) return;
    
    const room = roomService.getRoom(roomId);
    if (!room) return;
    
    let targetSocketId = null;
    for (const [socketId, userInfo] of room.users) {
      if (userInfo.userId === targetUserId) {
        targetSocketId = socketId;
        break;
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice_candidate', { candidate });
    }
  });

  // Call rejected
  socket.on('call_rejected', (data) => {
    const { fromUserId } = data;
    const roomId = getCurrentRoom();
    
    if (!roomId) return;
    
    const room = roomService.getRoom(roomId);
    if (!room) return;
    
    let callerSocketId = null;
    for (const [socketId, userInfo] of room.users) {
      if (userInfo.userId === fromUserId) {
        callerSocketId = socketId;
        break;
      }
    }
    
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected', { byUsername: getCurrentUsername() });
    }
    
    // Clear active call
    if (activeCalls.has(roomId)) {
      activeCalls.delete(roomId);
    }
  });

  // Call ended
  socket.on('call_ended', (data) => {
    const roomId = getCurrentRoom();
    if (!roomId) return;
    
    const call = activeCalls.get(roomId);
    if (call) {
      // Notify other participant
      const otherSocketId = call.callerId === socket.id ? call.calleeId : call.callerId;
      io.to(otherSocketId).emit('call_ended');
      activeCalls.delete(roomId);
      console.log(`📞 Call ended in ${roomId}`);
    } else {
      // Broadcast to room that call ended
      socket.to(roomId).emit('call_ended');
    }
  });

  // Cleanup calls on disconnect
  socket.on('disconnect', () => {
    for (const [roomId, call] of activeCalls) {
      if (call.callerId === socket.id || call.calleeId === socket.id) {
        const otherSocketId = call.callerId === socket.id ? call.calleeId : call.callerId;
        io.to(otherSocketId).emit('call_ended');
        activeCalls.delete(roomId);
        console.log(`📞 Call cleaned up for disconnected user in ${roomId}`);
      }
    }
  });
};