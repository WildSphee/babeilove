import bcrypt from 'bcrypt';
import { config } from '../config.js';

/**
 * Middleware to require authentication
 */
export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required'
  });
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password) {
  const { passwordHash } = config.auth;

  if (!passwordHash || passwordHash.includes('placeholder')) {
    console.warn('Warning: Using default password. Run "npm run hash-password" to set a secure password.');
    return password === 'password'; // Default for development
  }

  try {
    return await bcrypt.compare(password, passwordHash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Check if username matches
 */
export function verifyUsername(username) {
  return username === config.auth.username;
}
