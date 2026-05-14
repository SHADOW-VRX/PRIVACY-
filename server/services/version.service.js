const fs = require('fs');
const path = require('path');
const packageJson = require('../../package.json');

let cachedVersion = null;

function getVersion() {
  if (cachedVersion) return cachedVersion;
  
  try {
    const versionPath = path.join(__dirname, '../../VERSION');
    if (fs.existsSync(versionPath)) {
      cachedVersion = fs.readFileSync(versionPath, 'utf8').trim();
    } else {
      cachedVersion = packageJson.version;
    }
  } catch (error) {
    cachedVersion = packageJson.version;
  }
  
  return cachedVersion;
}

function getVersionInfo(environment) {
  return {
    name: 'PRIVACY',
    version: getVersion(),
    environment: environment || 'development',
    features: ['chat', 'voice-call', 'video-call', 'ephemeral-rooms']
  };
}

module.exports = { getVersion, getVersionInfo };