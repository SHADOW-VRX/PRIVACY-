// In-memory room storage (volatile - no persistence)
const rooms = new Map(); // roomId -> { users: Map, createdAt, lastActivity }

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = '';
    const length = Math.floor(Math.random() * 3) + 6;
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(id));
  return id;
}

function createRoom(roomId, customId = false) {
  if (rooms.has(roomId)) return null;
  rooms.set(roomId, {
    users: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now()
  });
  return rooms.get(roomId);
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function roomExists(roomId) {
  return rooms.has(roomId);
}

function addUserToRoom(roomId, socketId, userId, username) {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.users.set(socketId, { userId, socketId, username });
  room.lastActivity = Date.now();
  return true;
}

function removeUserFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const userInfo = room.users.get(socketId);
  room.users.delete(socketId);
  return userInfo;
}

function getUserCount(roomId) {
  const room = rooms.get(roomId);
  return room ? room.users.size : 0;
}

function getRoomUsers(roomId) {
  const room = rooms.get(roomId);
  return room ? Array.from(room.users.values()) : [];
}

function destroyRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (room && room.users.size === 0) {
    rooms.delete(roomId);
    console.log(`💀 Room ${roomId} destroyed - zero traces remaining`);
    return true;
  }
  return false;
}

function getActiveRoomsCount() {
  return rooms.size;
}

function cleanupStaleRooms(maxInactiveMs = 3600000) {
  const now = Date.now();
  let cleaned = 0;
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > maxInactiveMs && room.users.size === 0) {
      rooms.delete(roomId);
      cleaned++;
    }
  }
  return cleaned;
}

module.exports = {
  rooms,
  generateRoomId,
  createRoom,
  getRoom,
  roomExists,
  addUserToRoom,
  removeUserFromRoom,
  getUserCount,
  getRoomUsers,
  destroyRoomIfEmpty,
  getActiveRoomsCount,
  cleanupStaleRooms
};