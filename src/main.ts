import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import * as path from 'path';
import { InputBlocker } from './native/inputBlocker';

let mainWindow: BrowserWindow | null = null;
let inputBlocker: InputBlocker | null = null;

// Password per uscire dalla modalità kiosk (modificabile)
const EXIT_PASSWORD = 'admin123';
let passwordBuffer = '';

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Blocca il menu di contesto
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // Previeni la navigazione
  mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Nascondi il cursore (opzionale, commentabile se serve vedere il cursore)
  mainWindow.webContents.insertCSS('* { cursor: none !important; }');

  blockAllInputs();
  registerSecretExit();
}

function blockAllInputs() {
  inputBlocker = new InputBlocker();

  const platform = process.platform;

  if (platform === 'darwin') {
    // Mac
    inputBlocker.blockMacInput();
  } else if (platform === 'win32') {
    // Windows
    inputBlocker.blockWindowsInput();
  }

  // Blocca tutte le scorciatoie globali comuni
  const shortcuts = [
    'CommandOrControl+Q',
    'CommandOrControl+W',
    'CommandOrControl+R',
    'CommandOrControl+T',
    'CommandOrControl+N',
    'CommandOrControl+Shift+Q',
    'CommandOrControl+Alt+Esc',
    'CommandOrControl+Tab',
    'Alt+F4',
    'Alt+Tab',
    'Escape',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    'CommandOrControl+F1',
    'CommandOrControl+F2',
    'CommandOrControl+F3',
    'CommandOrControl+F4',
    'CommandOrControl+F5',
    'CommandOrControl+F6',
    'CommandOrControl+F7',
    'CommandOrControl+F8',
    'CommandOrControl+F9',
    'CommandOrControl+F10',
    'CommandOrControl+F11',
    'CommandOrControl+F12',
  ];

  shortcuts.forEach(shortcut => {
    globalShortcut.register(shortcut, () => {
      // Blocca la shortcut non facendo nulla
    });
  });

  // Blocca Command+H su Mac (nascondi app)
  if (platform === 'darwin') {
    globalShortcut.register('Command+H', () => {});
    globalShortcut.register('Command+M', () => {});
    globalShortcut.register('Command+Option+H', () => {});
  }
}

function registerSecretExit() {
  // Modalità di uscita segreta: digita la password nascosta
  // Ogni tasto viene aggiunto al buffer, se corrisponde alla password esce
  mainWindow?.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key.length === 1) {
        passwordBuffer += input.key;

        // Mantieni il buffer alla lunghezza della password
        if (passwordBuffer.length > EXIT_PASSWORD.length) {
          passwordBuffer = passwordBuffer.slice(-EXIT_PASSWORD.length);
        }

        // Controlla se la password è corretta
        if (passwordBuffer === EXIT_PASSWORD) {
          console.log('Password corretta, uscita dal kiosk mode');
          quitApp();
        }
      } else if (input.key === 'Backspace') {
        passwordBuffer = passwordBuffer.slice(0, -1);
      }
    }
  });
}

function quitApp() {
  // Sblocca l'input prima di uscire
  if (inputBlocker) {
    inputBlocker.unblock();
  }

  globalShortcut.unregisterAll();

  if (mainWindow) {
    mainWindow.destroy();
  }

  app.quit();
}

app.whenReady().then(() => {
  // Previeni l'apertura di nuove finestre
  app.on('browser-window-created', (_, window) => {
    window.removeMenu();
  });

  createWindow();
});

app.on('window-all-closed', () => {
  // Previeni la chiusura completa dell'app
  if (process.platform !== 'darwin') {
    // Su Mac normalmente le app rimangono aperte, ma qui forziamo la chiusura
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (inputBlocker) {
    inputBlocker.unblock();
  }
});

// Previeni suspend/sleep
app.on('browser-window-blur', () => {
  if (mainWindow) {
    mainWindow.focus();
  }
});
