import { v4 as uuidv4 } from 'uuid';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { config } from '../config.js';
import * as storage from './storage.js';

/**
 * Get timeline data with memories, config, and stats
 */
export async function getTimeline(options = {}) {
  const { order, limit = 50, offset = 0 } = options;

  const appConfig = await storage.getConfig();
  const timelineOrder = order || appConfig.timelineOrder || 'newest-first';

  const allMemories = await storage.getMemoriesSorted(timelineOrder);
  const memories = allMemories.slice(offset, offset + limit);

  // Calculate stats
  const stats = {
    totalMemories: allMemories.length,
    daysTogether: null
  };

  if (appConfig.relationshipStartDate) {
    const startDate = new Date(appConfig.relationshipStartDate);
    const today = new Date();
    const diffTime = Math.abs(today - startDate);
    stats.daysTogether = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  return {
    memories,
    config: appConfig,
    stats
  };
}

/**
 * Create a new memory
 */
export async function createMemory({ file, date, caption }) {
  const id = uuidv4();
  const ext = getExtension(file.originalname);
  const mediaPath = `${id}${ext}`;

  const memory = {
    id,
    mediaPath,
    mediaType: file.mimetype.startsWith('image/') ? 'image' : 'video',
    mimeType: file.mimetype,
    caption: caption || '',
    date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fileSize: file.size,
    imported: false
  };

  await storage.addMemory(memory);
  return memory;
}

/**
 * Get a single memory by ID
 */
export async function getMemory(id) {
  return storage.getMemoryById(id);
}

/**
 * Update a memory
 */
export async function updateMemory(id, updates) {
  const allowedUpdates = {};

  if (updates.caption !== undefined) {
    allowedUpdates.caption = updates.caption;
  }

  if (updates.date !== undefined) {
    allowedUpdates.date = updates.date;
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return storage.getMemoryById(id);
  }

  return storage.updateMemory(id, allowedUpdates);
}

/**
 * Delete a memory and its media file
 */
export async function deleteMemory(id) {
  const memory = await storage.getMemoryById(id);

  if (!memory) {
    return null;
  }

  // Delete the media file
  const mediaPath = join(config.paths.media, memory.mediaPath);
  try {
    await unlink(mediaPath);
  } catch (error) {
    console.warn(`Could not delete media file ${mediaPath}:`, error.message);
  }

  // Delete from storage
  return storage.deleteMemory(id);
}

/**
 * Get file extension from filename
 */
function getExtension(filename) {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Validate file for upload
 */
export function validateFile(file) {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  if (file.size > config.upload.maxFileSize) {
    errors.push(`File size exceeds maximum of ${config.upload.maxFileSize / 1024 / 1024}MB`);
  }

  if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
    errors.push(`File type ${file.mimetype} is not supported. Allowed: ${config.upload.allowedMimeTypes.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
