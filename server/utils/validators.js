const config = require('../config/env');

function isValidUsername(username) {
  if (!username) return false;
  const sanitized = String(username).trim();
  return sanitized.length > 0 && sanitized.length <= config.MAX_USERNAME_LENGTH;
}

function isValidMessage(message) {
  if (!message) return false;
  const sanitized = String(message).trim();
  return sanitized.length > 0 && sanitized.length <= config.MAX_MESSAGE_LENGTH;
}

function isValidRoomId(roomId) {
  if (!roomId) return false;
  const pattern = /^[A-Za-z0-9_-]+$/;
  return pattern.test(roomId) && roomId.length >= 4 && roomId.length <= 32;
}

function isValidFileSize(sizeBytes) {
  const maxBytes = config.MAX_FILE_SIZE_MB * 1024 * 1024;
  return sizeBytes <= maxBytes;
}

module.exports = {
  isValidUsername,
  isValidMessage,
  isValidRoomId,
  isValidFileSize
};