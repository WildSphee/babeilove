import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import * as memoriesService from '../services/memories.js';
import * as storage from '../services/storage.js';

const router = Router();

// SSE clients for real-time updates
const sseClients = new Set();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: config.paths.media,
    filename: (req, file, cb) => {
      // Temporary filename - will be renamed after creating memory
      const tempName = `temp_${Date.now()}_${file.originalname}`;
      cb(null, tempName);
    }
  }),
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported`), false);
    }
  }
});

/**
 * GET /api/timeline
 * Get timeline with memories, config, and stats
 */
router.get('/timeline', requireAuth, async (req, res, next) => {
  try {
    const { order, limit, offset } = req.query;

    const timeline = await memoriesService.getTimeline({
      order,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });

    res.json(timeline);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/memories
 * Upload a new memory
 */
router.post('/memories', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { date, caption } = req.body;
    const file = req.file;

    // Validate file
    const validation = memoriesService.validateFile(file);
    if (!validation.valid) {
      // Clean up uploaded file
      if (file) {
        const fs = await import('fs/promises');
        await fs.unlink(file.path).catch(() => {});
      }
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.errors.join(', ')
      });
    }

    // Validate date
    if (!date) {
      if (file) {
        const fs = await import('fs/promises');
        await fs.unlink(file.path).catch(() => {});
      }
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Date is required'
      });
    }

    // Create memory
    const memory = await memoriesService.createMemory({
      file,
      date,
      caption
    });

    // Rename temp file to final name
    const fs = await import('fs/promises');
    const finalPath = join(config.paths.media, memory.mediaPath);
    await fs.rename(file.path, finalPath);

    // Broadcast to SSE clients
    broadcastEvent('memory:created', memory);

    res.status(201).json(memory);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      const fs = await import('fs/promises');
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
});

/**
 * GET /api/memories/:id
 * Get a single memory
 */
router.get('/memories/:id', requireAuth, async (req, res, next) => {
  try {
    const memory = await memoriesService.getMemory(req.params.id);

    if (!memory) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Memory not found'
      });
    }

    res.json(memory);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/memories/:id
 * Update a memory's caption or date
 */
router.patch('/memories/:id', requireAuth, async (req, res, next) => {
  try {
    const { caption, date } = req.body;

    const memory = await memoriesService.updateMemory(req.params.id, {
      caption,
      date
    });

    if (!memory) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Memory not found'
      });
    }

    // Broadcast to SSE clients
    broadcastEvent('memory:updated', memory);

    res.json(memory);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/memories/:id
 * Delete a memory and its media file
 */
router.delete('/memories/:id', requireAuth, async (req, res, next) => {
  try {
    const memory = await memoriesService.deleteMemory(req.params.id);

    if (!memory) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Memory not found'
      });
    }

    // Broadcast to SSE clients
    broadcastEvent('memory:deleted', { id: req.params.id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/config
 * Get application configuration
 */
router.get('/config', requireAuth, async (req, res, next) => {
  try {
    const appConfig = await storage.getConfig();
    res.json(appConfig);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/config
 * Update application configuration
 */
router.patch('/config', requireAuth, async (req, res, next) => {
  try {
    const { relationshipStartDate, timelineOrder, title, subtitle } = req.body;

    const updates = {};
    if (relationshipStartDate !== undefined) updates.relationshipStartDate = relationshipStartDate;
    if (timelineOrder !== undefined) updates.timelineOrder = timelineOrder;
    if (title !== undefined) updates.title = title;
    if (subtitle !== undefined) updates.subtitle = subtitle;

    const appConfig = await storage.updateConfig(updates);
    res.json(appConfig);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/events
 * Server-Sent Events for real-time updates
 */
router.get('/events', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection message
  res.write('event: connected\ndata: {}\n\n');

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  // Add client to set
  sseClients.add(res);

  // Remove client on close
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

/**
 * Broadcast event to all SSE clients
 */
function broadcastEvent(eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending SSE:', error);
      sseClients.delete(client);
    }
  });
}

export default router;
