# 🔒 PRIVACY — Private Chats. Zero Traces.

![Version](https://img.shields.io/badge/version-1.0.0-red)
![Node](https://img.shields.io/badge/node-14%2B-green)
![License](https://img.shields.io/badge/license-MIT-red)
![Privacy](https://img.shields.io/badge/privacy-first-black)

> **Ephemeral chat application with self-destructing rooms. No database. No logs. No traces.**

---

## 📋 Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [How to Use](#how-to-use)
- [Architecture](#architecture)
- [Security & Privacy](#security--privacy)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 About

**PRIVACY** is a cyberpunk-themed, ephemeral chat application designed for secure, anonymous communication with zero persistence. Every room self-destructs when the last user leaves, leaving no traces behind. No database, no file storage, no logs—just pure, real-time communication.

Perfect for:
- 🔐 Sensitive conversations
- 👻 Anonymous discussions
- 💨 Temporary group chats
- 🎮 Gaming sessions
- 🤝 One-time meetings

---

## ✨ Features

### Core Features
- **🚀 Real-time Messaging** — Powered by WebSocket (Socket.io)
- **💀 Self-Destructing Rooms** — Rooms vanish when empty
- **🔒 No Database** — All data stored in memory only
- **📁 File Sharing** — Images & files transmitted as Base64
- **👻 Anonymous Users** — No registration required
- **⌨️ Typing Indicators** — Live typing notifications
- **📊 User Count Display** — See active users in room
- **🎨 Cyberpunk UI** — Glitch effects, neon aesthetics, terminal design

### Security Features
- ✅ **Zero Persistence** — No messages saved to disk
- ✅ **No Logs** — Server doesn't log message content
- ✅ **Auto-Cleanup** — Rooms destroyed immediately when empty
- ✅ **In-Memory Only** — Everything stored in RAM
- ✅ **No Tracking** — No analytics, no cookies
- ✅ **Anonymous** — No user data collected

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Backend runtime |
| **Express.js** | HTTP server |
| **Socket.io** | WebSocket real-time communication |
| **HTML5/CSS3** | Frontend structure & styling |
| **Vanilla JavaScript** | Client-side logic |
| **Font Awesome** | Icons |
| **Google Fonts** | Typography (Fira Code) |

---

## 📦 Installation

### Prerequisites
- **Node.js** (v14 or higher)
- **npm** (v6 or higher)

### Step 1: Clone or Download
```bash
git clone https://github.com/yourusername/PRIVACY.git
cd PRIVACY
## 🚀 Deployment Guide

### Running with Load Balancer

1. Install NGINX
2. Copy `nginx/nginx.conf` to `/etc/nginx/sites-available/privacy`
3. Update the upstream server list with your Node.js instances
4. Run multiple Node.js instances:
   ```bash
   PORT=3000 npm start &
   PORT=3001 npm start &
   PORT=3002 npm start &