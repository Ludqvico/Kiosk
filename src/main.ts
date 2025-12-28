import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { InputBlocker } from './native/inputBlocker';
import { ServerConnection } from './serverConnection';

// Carica variabili d'ambiente dal file .env
dotenv.config();

let mainWindow: BrowserWindow | null = null;
let inputBlocker: InputBlocker | null = null;
let serverConnection: ServerConnection | null = null;
let isLocked = false;

// Configurazione
const EXIT_PASSWORD = process.env.EXIT_PASSWORD || 'admin123';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const STANDALONE_MODE = process.env.STANDALONE_MODE === 'true'; // Se true, non si connette al server
let passwordBuffer = '';

console.log('[Config] SERVER_URL:', SERVER_URL);
console.log('[Config] STANDALONE_MODE:', STANDALONE_MODE);

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    show: false, // Non mostrare all'avvio
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

  // Se in modalità standalone, blocca immediatamente
  if (STANDALONE_MODE) {
    console.log('[Main] Modalità STANDALONE - Blocco automatico');
    lockKiosk();
  } else {
    console.log('[Main] Modalità CLIENT-SERVER - In attesa comandi dal server (client nascosto)');
  }

  registerSecretExit();
}

function lockKiosk() {
  if (isLocked) {
    console.log('[Main] Kiosk già bloccato');
    return;
  }

  console.log('[Main] BLOCCO KIOSK');

  // Mostra la finestra fullscreen
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');

    // Nascondi cursore
    mainWindow.webContents.insertCSS('* { cursor: none !important; }');
  }

  // Blocca input nativo a livello di sistema
  inputBlocker = new InputBlocker();
  const platform = process.platform;

  if (platform === 'darwin') {
    inputBlocker.blockMacInput();
  } else if (platform === 'win32') {
    inputBlocker.blockWindowsInput();
  }

  // Blocca TUTTE le shortcut globali
  blockGlobalShortcuts();

  isLocked = true;

  // Notifica il server dello stato
  if (serverConnection) {
    serverConnection.sendStatus(true);
  }

  console.log('[Main] Kiosk BLOCCATO');
}

function unlockKiosk() {
  if (!isLocked) {
    console.log('[Main] Kiosk già sbloccato');
    return;
  }

  console.log('[Main] SBLOCCO KIOSK');

  // Nascondi la finestra completamente
  if (mainWindow) {
    mainWindow.hide();

    // Ripristina cursore (nel caso)
    mainWindow.webContents.insertCSS('* { cursor: auto !important; }');
  }

  // Sblocca input nativo
  if (inputBlocker) {
    inputBlocker.unblock();
    inputBlocker = null;
  }

  // Sblocca TUTTE le shortcut
  globalShortcut.unregisterAll();

  isLocked = false;

  // Notifica il server dello stato
  if (serverConnection) {
    serverConnection.sendStatus(false);
  }

  console.log('[Main] Kiosk SBLOCCATO');
}

function blockGlobalShortcuts() {
  // Blocca TUTTE le scorciatoie globali comuni
  const shortcuts = [
    // Chiusura e navigazione
    'CommandOrControl+Q',
    'CommandOrControl+W',
    'CommandOrControl+R',
    'CommandOrControl+T',
    'CommandOrControl+N',
    'CommandOrControl+Shift+Q',
    'Alt+F4',

    // Task switching
    'CommandOrControl+Tab',
    'CommandOrControl+Shift+Tab',
    'Alt+Tab',
    'Alt+Shift+Tab',

    // Windows specific
    'Control+Shift+Escape',  // Task Manager
    'Win',                   // Start menu
    'Super',                 // Start menu (Linux)

    // Tasti funzione
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    'CommandOrControl+F1', 'CommandOrControl+F2', 'CommandOrControl+F3',
    'CommandOrControl+F4', 'CommandOrControl+F5', 'CommandOrControl+F6',
    'CommandOrControl+F7', 'CommandOrControl+F8', 'CommandOrControl+F9',
    'CommandOrControl+F10', 'CommandOrControl+F11', 'CommandOrControl+F12',

    // Escape
    'Escape',
    'CommandOrControl+Escape',
    'CommandOrControl+Alt+Escape',

    // Mac specific
    'Command+H',             // Hide
    'Command+M',             // Minimize
    'Command+Option+H',      // Hide Others
    'Command+Option+Escape', // Force Quit

    // Zoom e altre funzioni
    'CommandOrControl+Plus',
    'CommandOrControl+Minus',
    'CommandOrControl+0',

    // Developer tools
    'CommandOrControl+Shift+I',
    'CommandOrControl+Shift+J',
    'CommandOrControl+Shift+C',
    'F12',
  ];

  let blocked = 0;
  shortcuts.forEach(shortcut => {
    const success = globalShortcut.register(shortcut, () => {
      // Blocca la shortcut non facendo nulla
      console.log(`[Shortcut] Bloccato tentativo di usare: ${shortcut}`);
    });

    if (success) blocked++;
  });

  console.log(`[Shortcut] Bloccate ${blocked}/${shortcuts.length} scorciatoie globali`);
}

function registerSecretExit() {
  // Modalità di uscita segreta: digita la password nascosta
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
          console.log('[Main] Password corretta, uscita dal kiosk mode');
          quitApp();
        }
      } else if (input.key === 'Backspace') {
        passwordBuffer = passwordBuffer.slice(0, -1);
      }
    }
  });
}

function connectToServer() {
  if (STANDALONE_MODE) {
    console.log('[Main] Modalità standalone - Connessione al server disabilitata');
    return;
  }

  console.log('[Main] Connessione al server...', SERVER_URL);

  serverConnection = new ServerConnection(SERVER_URL);

  // Registra callback per comandi dal server
  serverConnection.onLock(() => {
    console.log('[Main] Ricevuto comando LOCK dal server');
    lockKiosk();
  });

  serverConnection.onUnlock(() => {
    console.log('[Main] Ricevuto comando UNLOCK dal server');
    unlockKiosk();
  });

  // Connetti
  serverConnection.connect();
}

function quitApp() {
  // Disconnetti dal server
  if (serverConnection) {
    serverConnection.disconnect();
  }

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

  // Connetti al server (se non in modalità standalone)
  connectToServer();
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
  if (serverConnection) {
    serverConnection.disconnect();
  }
});

// Previeni suspend/sleep
app.on('browser-window-blur', () => {
  if (mainWindow) {
    mainWindow.focus();
  }
});
