import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenvConfig({ path: join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,

  auth: {
    username: process.env.AUTH_USERNAME || 'couple',
    passwordHash: process.env.AUTH_PASSWORD || '',
    sessionSecret: process.env.SESSION_SECRET || 'change-this-secret'
  },

  paths: {
    data: join(__dirname, '../../data'),
    media: join(__dirname, '../../media'),
    frontend: join(__dirname, '../../frontend/src'),
    memoriesFile: join(__dirname, '../../data/memories.json')
  },

  upload: {
    maxFileSize: 100 * 1024 * 1024, // 100 MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/quicktime'
    ]
  },

  session: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
};
