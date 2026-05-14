const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// HTTP rate limiter
const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const roomCreateLimiter = rateLimit({
  windowMs: config.ROOM_CREATE_LIMIT_WINDOW_MS,
  max: config.ROOM_CREATE_LIMIT_MAX,
  message: { error: 'Too many rooms created. Please wait before creating more.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Socket.IO rate limiting helper
class SocketRateLimiter {
  constructor(maxPerWindow, windowMs) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
    this.clients = new Map();
  }

  isAllowed(socketId, eventType) {
    const key = `${socketId}:${eventType}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.clients.has(key)) {
      this.clients.set(key, [now]);
      return true;
    }
    
    const timestamps = this.clients.get(key).filter(t => t > windowStart);
    
    if (timestamps.length >= this.maxPerWindow) {
      return false;
    }
    
    timestamps.push(now);
    this.clients.set(key, timestamps);
    return true;
  }

  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.clients) {
      const filtered = timestamps.filter(t => t > windowStart);
      if (filtered.length === 0) {
        this.clients.delete(key);
      } else {
        this.clients.set(key, filtered);
      }
    }
  }
}

// Different rate limiters for different events
const messageLimiter = new SocketRateLimiter(10, 10000);
const typingLimiter = new SocketRateLimiter(30, 60000);
const callLimiter = new SocketRateLimiter(5, 30000);
const roomActionLimiter = new SocketRateLimiter(3, 60000);

module.exports = {
  generalLimiter,
  roomCreateLimiter,
  messageLimiter,
  typingLimiter,
  callLimiter,
  roomActionLimiter,
  SocketRateLimiter
};
