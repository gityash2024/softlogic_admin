#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env.local');
const contents = 'VITE_API_BASE_URL=http://localhost:3000/api/v1\n';

if (!fs.existsSync(envFile)) {
  fs.writeFileSync(envFile, contents, { encoding: 'utf8' });
  console.log('Created ignored admin local env profile: .env.local');
} else {
  const existing = fs.readFileSync(envFile, 'utf8');
  if (!/^VITE_API_BASE_URL=/m.test(existing)) {
    fs.appendFileSync(envFile, contents, { encoding: 'utf8' });
    console.log('Added local API base URL to admin .env.local');
  } else {
    console.log('Admin local env profile is ready.');
  }
}
