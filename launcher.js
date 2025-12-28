const { spawn } = require('child_process');
const path = require('path');

// Nascondi la console Windows
if (process.platform === 'win32') {
  const electron = require('electron');
  const appPath = path.join(__dirname, 'dist', 'main.js');

  // Avvia Electron SENZA console
  const child = spawn(electron, [appPath], {
    detached: false,
    stdio: 'ignore',
    windowsHide: true
  });

  child.unref();
  process.exit(0);
} else {
  // Su Mac/Linux avvia normalmente
  require('./dist/main.js');
}
