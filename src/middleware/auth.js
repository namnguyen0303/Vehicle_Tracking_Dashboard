const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Verify JWT from Authorization header and attach user to req.
 * Returns 401 if missing or invalid.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Verify JWT from a token string (e.g. WebSocket query param).
 * Returns decoded payload or null.
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwt.secret);
  } catch {
    return null;
  }
}

module.exports = {
  requireAuth,
  verifyToken,
};
