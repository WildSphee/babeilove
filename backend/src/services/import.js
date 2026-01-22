import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import * as storage from './storage.js';

// Supported file extensions and their MIME types
const supportedFormats = {
  '.jpg': { mimeType: 'image/jpeg', mediaType: 'image' },
  '.jpeg': { mimeType: 'image/jpeg', mediaType: 'image' },
  '.png': { mimeType: 'image/png', mediaType: 'image' },
  '.mp4': { mimeType: 'video/mp4', mediaType: 'video' },
  '.mov': { mimeType: 'video/quicktime', mediaType: 'video' }
};

/**
 * Import existing media files from the media directory
 * Creates memory entries for files that don't already have one
 */
export async function importExistingMedia() {
  const mediaDir = config.paths.media;
  let importedCount = 0;

  try {
    const files = await readdir(mediaDir);

    for (const filename of files) {
      // Skip hidden files and temp files
      if (filename.startsWith('.') || filename.startsWith('temp_')) {
        continue;
      }

      const ext = extname(filename).toLowerCase();
      const format = supportedFormats[ext];

      // Skip unsupported formats
      if (!format) {
        continue;
      }

      // Check if already imported
      const exists = await storage.mediaPathExists(filename);
      if (exists) {
        continue;
      }

      // Get file stats
      const filePath = join(mediaDir, filename);
      const stats = await stat(filePath);

      // Skip directories
      if (stats.isDirectory()) {
        continue;
      }

      // Check file size
      if (stats.size > config.upload.maxFileSize) {
        console.warn(`Skipping ${filename}: exceeds max file size`);
        continue;
      }

      // Extract date (use file mtime as fallback)
      const date = await extractDate(filePath, stats);

      // Create memory entry
      const memory = {
        id: uuidv4(),
        mediaPath: filename,
        mediaType: format.mediaType,
        mimeType: format.mimeType,
        caption: '', // User can add caption later
        date: date.toISOString().split('T')[0], // YYYY-MM-DD format
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileSize: stats.size,
        imported: true
      };

      await storage.addMemory(memory);
      importedCount++;
      console.log(`Imported: ${filename}`);
    }

    return importedCount;
  } catch (error) {
    console.error('Error importing media:', error);
    throw error;
  }
}

/**
 * Extract date from file
 * Could be extended to read EXIF data for images
 */
async function extractDate(filePath, stats) {
  // For now, use file modification time
  // TODO: Could add EXIF reading for images using a library like exif-parser

  // Use mtime (modification time) as the date
  return stats.mtime;
}

/**
 * Check if a file is a supported media format
 */
export function isSupportedFormat(filename) {
  const ext = extname(filename).toLowerCase();
  return ext in supportedFormats;
}
