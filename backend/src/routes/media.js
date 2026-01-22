import { Router } from 'express';
import { createReadStream, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { config } from '../config.js';

const router = Router();

// MIME type mapping
const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime'
};

/**
 * GET /media/:filename
 * Serve media files with range request support for video streaming
 */
router.get('/:filename', (req, res) => {
  const { filename } = req.params;

  // Sanitize filename to prevent path traversal
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (sanitized !== filename) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid filename'
    });
  }

  const filePath = join(config.paths.media, sanitized);

  // Check if file exists
  if (!existsSync(filePath)) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Media file not found'
    });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const ext = extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // Handle range requests for video streaming
  const range = req.headers.range;

  if (range && mimeType.startsWith('video/')) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType
    });

    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    // Full file response
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes'
    });

    createReadStream(filePath).pipe(res);
  }
});

export default router;
