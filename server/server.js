const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config/env');
const { securityHeaders, corsConfig } = require('./middleware/securityHeaders');
const { generalLimiter } = require('./middleware/rateLimiter');
const roomService = require('./services/room.service');
const { getVersionInfo } = require('./services/version.service');

const app = express();
const server = http.createServer(app);

// Apply security middleware
app.use(securityHeaders);
app.use(corsConfig);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use('/api/', generalLimiter);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.get('/api/version', (req, res) => {
  res.json(getVersionInfo(config.NODE_ENV));
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: Date.now(),
    activeRooms: roomService.getActiveRoomsCount()
  });
});

// Socket.IO with sticky session support for load balancing
const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowUpgrades: true
});

// Track client state for each socket
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Initialize chat state for this socket
  const chatState = { currentRoomId: null, currentUsername: null, userId: null };
  
  // Initialize chat socket handlers
  const chatHandlers = require('./sockets/chat.socket')(io, socket);
  chatState.currentRoomId = chatHandlers.currentRoomId;
  chatState.currentUsername = chatHandlers.currentUsername;
  chatState.userId = chatHandlers.userId;
  
  // Initialize call socket handlers with access to chat state
  require('./sockets/call.socket')(io, socket, chatState);
});

// Periodic cleanup of stale rooms
setInterval(() => {
  const cleaned = roomService.cleanupStaleRooms(3600000);
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} stale PRIVACY rooms`);
  }
}, 300000);

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
server.listen(config.PORT, () => {
  console.log(`
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                                                                   ║
    ║   🔒 PRIVACY — Private Chats. Zero Traces.                        ║
    ║                                                                   ║
    ║   📡 WebSocket: ws://localhost:${config.PORT}                          ║
    ║   🌐 HTTP: http://localhost:${config.PORT}                         ║
    ║                                                                   ║
    ║   💀 Zero Persistence | No Database                               ║
    ║   🔥 Rooms Self-Destruct When Empty                               ║
    ║   👤 Custom Usernames | Left/Right Chat Layout                    ║
    ║   🚫 No Duplicate Messages | Real-time                            ║
    ║   🎥 Voice & Video Calls | WebRTC                                 ║
    ║   🛡️ Rate Limited | Security Hardened                            ║
    ║                                                                   ║
    ║   Environment: ${config.NODE_ENV.padEnd(20)}                        ║
    ║                                                                   ║
    ╚═══════════════════════════════════════════════════════════════════╝
  `);
});
