#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Get current timestamp
const buildTime = new Date().toISOString();

// Get git commit hash (short)
let gitCommit = 'Unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('Could not get git commit:', error.message);
}

// Get git branch
let gitBranch = 'Unknown';
try {
  gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('Could not get git branch:', error.message);
}

// Generate build number based on timestamp
const buildNumber = Date.now().toString();

// Read package.json for version
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Create .env.local file with build info
const envContent = `# Auto-generated build information
VITE_APP_VERSION=${version}
VITE_BUILD_TIME=${buildTime}
VITE_GIT_COMMIT=${gitCommit}
VITE_GIT_BRANCH=${gitBranch}
VITE_BUILD_NUMBER=${buildNumber}
`;

fs.writeFileSync(path.join(__dirname, '.env.local'), envContent);

console.log('✅ Build info generated:');
console.log(`   Version: ${version}`);
console.log(`   Build Time: ${buildTime}`);
console.log(`   Git Commit: ${gitCommit}`);
console.log(`   Git Branch: ${gitBranch}`);
console.log(`   Build Number: ${buildNumber}`);
