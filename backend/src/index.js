import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import memoriesRoutes from './routes/memories.js';
import mediaRoutes from './routes/media.js';
import { loadData } from './services/storage.js';
import { importExistingMedia } from './services/import.js';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: config.auth.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: config.session.maxAge
  }
}));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', memoriesRoutes);

// Media serving with range support (before static middleware)
app.use('/media', mediaRoutes);

// Serve static frontend files
app.use(express.static(config.paths.frontend));

// Note: Media serving handled by mediaRoutes above for range support

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile('index.html', { root: config.paths.frontend });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message
  });
});

// Start server
async function start() {
  // Load data on startup
  await loadData();
  console.log('Data loaded from', config.paths.memoriesFile);

  // Import any existing media files
  try {
    const imported = await importExistingMedia();
    if (imported > 0) {
      console.log(`Imported ${imported} existing media files`);
    }
  } catch (error) {
    console.warn('Could not import existing media:', error.message);
  }

  app.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
    console.log('Frontend:', config.paths.frontend);
    console.log('Media:', config.paths.media);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
