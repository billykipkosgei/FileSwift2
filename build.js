const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

console.log('Building CSS...');
execSync('node build-css.js', { stdio: 'inherit' });

console.log('Building application...');
execSync('electron-builder --win', { stdio: 'inherit' });
