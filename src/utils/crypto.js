const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = 'todo-app-secret-key-for-tokens!!'; // 32 bytes for aes-256
const IV_LENGTH = 16;

/**
 * Generate a simple API token for a session.
 * Uses crypto.createCipheriv for secure token generation.
 */
function generateSessionToken(sessionId) {
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Validate and decode a session token.
 */
function validateSessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split(':');
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const [sessionId, timestamp] = decrypted.split(':');
    if (!sessionId || !timestamp) return null;

    // Tokens expire after 24 hours
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 24 * 60 * 60 * 1000) return null;

    return { sessionId, timestamp: parseInt(timestamp, 10) };
  } catch {
    return null;
  }
}

/**
 * Generate a hash for content integrity verification.
 */
function hashContent(content) {
  return crypto
    .createHash('sha256')
    .update(Buffer.from(String(content)))
    .digest('hex');
}

module.exports = {
  generateSessionToken,
  validateSessionToken,
  hashContent,
};
