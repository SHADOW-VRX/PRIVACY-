const config = require('../config/env');

function escapeHtml(text) {
  if (!text) return '';
  const div = document = {
    createElement: () => ({
      textContent: '',
      innerHTML: ''
    })
  }; // Fallback for server
  // Simple HTML escaping for server
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUsername(username) {
  if (!username) return 'Anonymous';
  let sanitized = String(username).trim();
  if (sanitized.length > config.MAX_USERNAME_LENGTH) {
    sanitized = sanitized.substring(0, config.MAX_USERNAME_LENGTH);
  }
  // Remove any script-like content
  sanitized = sanitized.replace(/[<>]/g, '');
  if (sanitized.length === 0) return 'Anonymous';
  return sanitized;
}

function sanitizeMessage(message) {
  if (!message) return '';
  let sanitized = String(message).trim();
  if (sanitized.length > config.MAX_MESSAGE_LENGTH) {
    sanitized = sanitized.substring(0, config.MAX_MESSAGE_LENGTH);
  }
  return sanitized;
}

function validateRoomId(roomId) {
  if (!roomId) return false;
  // Allow alphanumeric, underscore, hyphen
  const validPattern = /^[A-Za-z0-9_-]+$/;
  return validPattern.test(roomId) && roomId.length <= 32;
}

module.exports = {
  escapeHtml,
  sanitizeUsername,
  sanitizeMessage,
  validateRoomId
};