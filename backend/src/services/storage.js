import { readFile, writeFile, rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config.js';

const SCHEMA_VERSION = 1;

// Default data structure
const defaultData = {
  version: SCHEMA_VERSION,
  config: {
    relationshipStartDate: null,
    timelineOrder: 'newest-first',
    title: 'Our Story',
    subtitle: null
  },
  memories: []
};

// In-memory cache
let data = null;

/**
 * Ensure directory exists
 */
async function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Load data from JSON file
 */
export async function loadData() {
  if (data !== null) {
    return data;
  }

  const filePath = config.paths.memoriesFile;

  try {
    if (!existsSync(filePath)) {
      await ensureDir(filePath);
      data = { ...defaultData };
      await saveData();
      return data;
    }

    const content = await readFile(filePath, 'utf-8');
    data = JSON.parse(content);

    // Handle schema migration if needed
    if (data.version !== SCHEMA_VERSION) {
      data = migrateSchema(data);
      await saveData();
    }

    return data;
  } catch (error) {
    console.error('Error loading data:', error);
    data = { ...defaultData };
    return data;
  }
}

/**
 * Save data to JSON file atomically
 */
export async function saveData() {
  if (data === null) {
    return;
  }

  const filePath = config.paths.memoriesFile;
  const tempPath = `${filePath}.tmp`;

  try {
    await ensureDir(filePath);

    // Write to temp file first
    const content = JSON.stringify(data, null, 2);
    await writeFile(tempPath, content, 'utf-8');

    // Atomic rename
    await rename(tempPath, filePath);
  } catch (error) {
    console.error('Error saving data:', error);
    throw error;
  }
}

/**
 * Migrate schema to current version
 */
function migrateSchema(oldData) {
  // Future migrations can be added here
  return {
    ...defaultData,
    ...oldData,
    version: SCHEMA_VERSION
  };
}

/**
 * Get all memories
 */
export async function getMemories() {
  const d = await loadData();
  return d.memories;
}

/**
 * Get memories sorted by date
 */
export async function getMemoriesSorted(order = 'newest-first') {
  const memories = await getMemories();
  const sorted = [...memories].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return order === 'newest-first' ? dateB - dateA : dateA - dateB;
  });
  return sorted;
}

/**
 * Get memory by ID
 */
export async function getMemoryById(id) {
  const memories = await getMemories();
  return memories.find(m => m.id === id);
}

/**
 * Add a new memory
 */
export async function addMemory(memory) {
  const d = await loadData();
  d.memories.push(memory);
  await saveData();
  return memory;
}

/**
 * Update a memory
 */
export async function updateMemory(id, updates) {
  const d = await loadData();
  const index = d.memories.findIndex(m => m.id === id);

  if (index === -1) {
    return null;
  }

  d.memories[index] = {
    ...d.memories[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await saveData();
  return d.memories[index];
}

/**
 * Delete a memory
 */
export async function deleteMemory(id) {
  const d = await loadData();
  const index = d.memories.findIndex(m => m.id === id);

  if (index === -1) {
    return null;
  }

  const [deleted] = d.memories.splice(index, 1);
  await saveData();
  return deleted;
}

/**
 * Get configuration
 */
export async function getConfig() {
  const d = await loadData();
  return d.config;
}

/**
 * Update configuration
 */
export async function updateConfig(updates) {
  const d = await loadData();
  d.config = { ...d.config, ...updates };
  await saveData();
  return d.config;
}

/**
 * Check if a media path already exists in memories
 */
export async function mediaPathExists(mediaPath) {
  const memories = await getMemories();
  return memories.some(m => m.mediaPath === mediaPath);
}
