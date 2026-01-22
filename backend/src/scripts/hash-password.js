#!/usr/bin/env node

/**
 * Password Hashing Utility
 * Generates a bcrypt hash for use in .env AUTH_PASSWORD
 *
 * Usage: node hash-password.js <password>
 * Or: npm run hash-password <password>
 */

import bcrypt from 'bcrypt';
import { createInterface } from 'readline';

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
}

async function main() {
  let password = process.argv[2];

  if (!password) {
    // Interactive mode - prompt for password
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    password = await new Promise((resolve) => {
      rl.question('Enter password to hash: ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  if (!password) {
    console.error('Error: No password provided');
    process.exit(1);
  }

  const hash = await hashPassword(password);

  console.log('\nPassword hash generated successfully!');
  console.log('\nAdd this to your .env file:');
  console.log(`AUTH_PASSWORD=${hash}`);
  console.log('\n');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
