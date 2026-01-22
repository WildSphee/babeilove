import { Router } from 'express';
import { verifyPassword, verifyUsername } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Username and password are required'
    });
  }

  const usernameValid = verifyUsername(username);
  const passwordValid = await verifyPassword(password);

  if (!usernameValid || !passwordValid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid username or password'
    });
  }

  req.session.authenticated = true;
  req.session.username = username;

  return res.json({
    authenticated: true,
    username
  });
});

/**
 * POST /api/auth/logout
 * End user session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.clearCookie('connect.sid');
    res.json({ authenticated: false });
  });
});

/**
 * GET /api/auth/status
 * Check current authentication status
 */
router.get('/status', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.json({
      authenticated: true,
      username: req.session.username
    });
  }

  return res.json({
    authenticated: false
  });
});

export default router;
