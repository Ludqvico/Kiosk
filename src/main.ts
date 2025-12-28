import { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ServerConnection } from './serverConnection';
import { InputInjection } from './inputInjection';

// Carica variabili d'ambiente dal file .env
dotenv.config();

let mainWindow: BrowserWindow | null = null;
let serverConnection: ServerConnection | null = null;
let webrtcWindow: BrowserWindow | null = null;
let inputInjection: InputInjection | null = null;
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

  // INTERCETTA E BLOCCA TUTTI I TENTATIVI DI CHIUSURA
  mainWindow.on('close', (e) => {
    if (isLocked) {
      e.preventDefault();
      console.log('[Main] Tentativo di chiusura BLOCCATO');
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Blocca menu di contesto
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // Previeni navigazione
  mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault();
  });

  // Previeni nuove finestre
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
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

// INTERCETTA chiusura app a livello globale
app.on('before-quit', (e) => {
  if (isLocked) {
    e.preventDefault();
    console.log('[Main] Tentativo di quit BLOCCATO');
  }
});

app.on('will-quit', (e) => {
  if (isLocked) {
    e.preventDefault();
    console.log('[Main] Tentativo di quit BLOCCATO');
  }
});

function lockKiosk() {
  if (isLocked) {
    console.log('[Main] Kiosk già bloccato');
    return;
  }

  console.log('[Main] BLOCCO KIOSK');

  // Blocca TUTTE le shortcut globali PRIMA di mostrare la finestra
  blockGlobalShortcuts();

  // TODO: Ri-implementare input blocking se necessario per kiosk mode

  // Mostra la finestra fullscreen DOPO aver bloccato tutto
  if (mainWindow) {
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  }

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

  // Sblocca TUTTE le shortcut
  globalShortcut.unregisterAll();

  // Nascondi la finestra completamente
  if (mainWindow) {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    mainWindow.hide();
  }

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
    try {
      const success = globalShortcut.register(shortcut, () => {
        // Blocca la shortcut non facendo nulla
        console.log(`[Shortcut] Bloccato tentativo di usare: ${shortcut}`);
      });
      if (success) blocked++;
    } catch (error) {
      // Ignora errori per shortcut non supportati
      console.log(`[Shortcut] Impossibile registrare: ${shortcut}`);
    }
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

  serverConnection.onReboot(() => {
    console.log('[Main] Ricevuto comando REBOOT dal server');
    rebootClient();
  });

  serverConnection.onShutdown((delay: number) => {
    console.log(`[Main] Ricevuto comando SHUTDOWN dal server (delay: ${delay}s)`);
    shutdownClient(delay);
  });

  serverConnection.onLogout(() => {
    console.log('[Main] Ricevuto comando LOGOUT dal server');
    logoutClient();
  });

  // WebRTC remote desktop callbacks
  serverConnection.onWebRTCStart(() => {
    console.log('[Main] Ricevuto comando START REMOTE DESKTOP dal server');
    startRemoteDesktop();
  });

  serverConnection.onWebRTCStop(() => {
    console.log('[Main] Ricevuto comando STOP REMOTE DESKTOP dal server');
    stopRemoteDesktop();
  });

  serverConnection.onWebRTCSignal((signal) => {
    console.log('[Main] Ricevuto segnale WebRTC:', signal.type);

    if (webrtcWindow && !webrtcWindow.isDestroyed()) {
      if (signal.type === 'answer' && signal.answer) {
        webrtcWindow.webContents.send('webrtc:answer', signal.answer);
      } else if (signal.type === 'candidate' && signal.candidate) {
        webrtcWindow.webContents.send('webrtc:candidate', signal.candidate);
      }
    }
  });

  serverConnection.onBlockInput((block) => {
    console.log(`[Main] Ricevuto comando ${block ? 'BLOCK' : 'UNBLOCK'} INPUT dal server`);
    if (block) {
      blockUserInput();
    } else {
      unblockUserInput();
    }
  });

  // Connetti
  serverConnection.connect();
}

function rebootClient() {
  console.log('[Main] RIAVVIO CLIENT in corso...');

  // Disconnetti dal server
  if (serverConnection) {
    serverConnection.disconnect();
  }

  // Riavvia l'app
  app.relaunch();
  app.exit(0);
}

function shutdownClient(delay: number) {
  console.log(`[Main] SHUTDOWN CLIENT in corso (delay: ${delay}s)...`);

  // Disconnetti dal server
  if (serverConnection) {
    serverConnection.disconnect();
  }

  const { exec } = require('child_process');
  const platform = process.platform;

  setTimeout(() => {
    if (platform === 'win32') {
      exec('shutdown /s /t 0');
    } else if (platform === 'darwin') {
      exec('sudo shutdown -h now');
    } else if (platform === 'linux') {
      exec('sudo shutdown -h now');
    }
    app.quit();
  }, delay * 1000);
}

function logoutClient() {
  console.log('[Main] LOGOUT CLIENT in corso...');

  // Disconnetti dal server
  if (serverConnection) {
    serverConnection.disconnect();
  }

  const { exec } = require('child_process');
  const platform = process.platform;

  if (platform === 'win32') {
    exec('shutdown /l');
  } else if (platform === 'darwin') {
    exec('osascript -e \'tell application "System Events" to log out\'');
  } else if (platform === 'linux') {
    exec('gnome-session-quit --logout --no-prompt');
  }

  app.quit();
}

// ========== INPUT BLOCKING (ALCATRAZ MODE - BRUTALE) ==========

let inputBlocked = false;
let inputBlockProcess: any = null;

function blockUserInput() {
  if (inputBlocked) {
    console.log('[Main] Input già bloccato');
    return;
  }

  console.log('[Main] ⛓️  BLOCCO INPUT UTENTE - MODALITÀ ALCATRAZ ⛓️');
  inputBlocked = true;

  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: USA LOW-LEVEL HOOKS per bloccare TUTTO a livello sistema
    const { spawn } = require('child_process');
    const path = require('path');

    const scriptPath = path.join(__dirname, '../src/native/win/InputBlocker.ps1');

    console.log('[Main] 🔒 Avvio blocco Windows con Low-Level Hooks...');
    console.log('[Main] Script path:', scriptPath);

    // Spawn PowerShell process che installa gli hook e resta attivo
    inputBlockProcess = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      'block'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    inputBlockProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      console.log('[InputBlocker] stdout:', output);

      if (output === 'HOOKS_INSTALLED') {
        console.log('[Main] ✅ HOOKS INSTALLATI - Input sistema BLOCCATO');
      } else if (output === 'BLOCKED') {
        console.log('[Main] ✅✅✅ INPUT COMPLETAMENTE BLOCCATO (Keyboard + Mouse Low-Level Hooks)');
        console.log('[Main] 🔐 Modalità ALCATRAZ attiva - ZERO interazioni possibili');
      } else if (output.startsWith('ERROR')) {
        console.error('[Main] ❌ Errore blocco:', output);
      }
    });

    inputBlockProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[InputBlocker] stderr:', data.toString().trim());
    });

    inputBlockProcess.on('exit', (code: number) => {
      console.log('[Main] 🔓 Processo InputBlocker terminato con codice:', code);
      inputBlocked = false;
      inputBlockProcess = null;
    });

  } else {
    // Mac/Linux: usa overlay come fallback
    console.warn('[Main] ⚠️  Blocco hook non supportato su questa piattaforma - uso overlay');
    createInputBlockOverlay();
  }
}

function createInputBlockOverlay() {
  // Overlay di fallback per piattaforme non-Windows
  const overlay = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  overlay.setIgnoreMouseEvents(false);
  overlay.setOpacity(0.01);
  overlay.loadURL('data:text/html,<body style="background:transparent;cursor:not-allowed;"></body>');
  console.log('[Main] ✓ Overlay di fallback creato');
}

function unblockUserInput() {
  if (!inputBlocked) {
    console.log('[Main] Input non era bloccato');
    return;
  }

  console.log('[Main] 🔓 SBLOCCO INPUT UTENTE');
  inputBlocked = false;

  const platform = process.platform;

  if (platform === 'win32' && inputBlockProcess) {
    // Windows: crea file di stop per far uscire il process dal loop
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const stopFile = path.join(os.tmpdir(), 'input_blocker_stop.flag');

    try {
      fs.writeFileSync(stopFile, 'STOP');
      console.log('[Main] ✓ File di stop creato:', stopFile);

      // Aspetta un po' e poi killa il processo se ancora attivo
      setTimeout(() => {
        if (inputBlockProcess && !inputBlockProcess.killed) {
          inputBlockProcess.kill();
          inputBlockProcess = null;
          console.log('[Main] ✓ Processo InputBlocker terminato forzatamente');
        }
      }, 2000);
    } catch (error) {
      console.error('[Main] Errore durante sblocco:', error);
      // Killa comunque il processo
      if (inputBlockProcess) {
        inputBlockProcess.kill();
        inputBlockProcess = null;
      }
    }
  }

  console.log('[Main] ✅✅✅ INPUT SBLOCCATO');
}

// ========== REMOTE DESKTOP (WebRTC) ==========

async function startRemoteDesktop() {
  console.log('[Main] Starting WebRTC remote desktop...');

  try {
    // Get screen sources
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 150, height: 150 } // Smaller thumbnail to reduce memory
    });

    if (sources.length === 0) {
      throw new Error('No screen source available');
    }

    // Extract ONLY the string ID, nothing else
    const sourceId = String(sources[0].id);
    console.log('[Main] Screen source ID:', sourceId, 'Type:', typeof sourceId);

    // Create hidden WebRTC window if not exists
    if (!webrtcWindow || webrtcWindow.isDestroyed()) {
      console.log('[Main] Creating WebRTC window...');

      webrtcWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      webrtcWindow.loadFile(path.join(__dirname, '../renderer/webrtc-capture.html'));

      // Setup IPC handlers for WebRTC window (only once)
      setupWebRTCHandlers();

      // Wait for window to be ready
      await new Promise<void>((resolve) => {
        webrtcWindow!.webContents.once('did-finish-load', () => {
          console.log('[Main] WebRTC window loaded');
          resolve();
        });
      });
    }

    // Send start command with only the string ID
    console.log('[Main] Sending start command to WebRTC renderer with sourceId:', sourceId);
    webrtcWindow.webContents.send('webrtc:start', sourceId);

    // Initialize input injection
    if (!inputInjection) {
      const primaryDisplay = screen.getPrimaryDisplay();
      inputInjection = new InputInjection(
        primaryDisplay.size.width,
        primaryDisplay.size.height
      );
    }

    console.log('[Main] WebRTC remote desktop initialization complete');
  } catch (error) {
    console.error('[Main] Error starting WebRTC:', error);

    if (serverConnection) {
      serverConnection.sendWebRTCSignal({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

function stopRemoteDesktop() {
  console.log('[Main] Stopping WebRTC remote desktop...');

  if (webrtcWindow) {
    webrtcWindow.webContents.send('webrtc:stop');
    webrtcWindow.close();
    webrtcWindow = null;
  }

  // Cleanup input injection
  if (inputInjection) {
    inputInjection.cleanup();
    inputInjection = null;
  }

  // Unblock client input if it was blocked
  if (inputBlocked) {
    unblockUserInput();
  }

  console.log('[Main] WebRTC remote desktop stopped');
}

let webrtcHandlersSetup = false;

function setupWebRTCHandlers() {
  // Prevent duplicate handler registration
  if (webrtcHandlersSetup) {
    console.log('[Main] WebRTC handlers already set up');
    return;
  }

  console.log('[Main] Setting up WebRTC IPC handlers');

  // Offer created by renderer
  ipcMain.on('webrtc:offer', (event, offer) => {
    console.log('[Main] Received offer from renderer');
    if (serverConnection) {
      serverConnection.sendWebRTCSignal({
        type: 'offer',
        offer
      });
    }
  });

  // ICE candidate from renderer
  ipcMain.on('webrtc:icecandidate', (event, candidate) => {
    console.log('[Main] Received ICE candidate from renderer');
    if (serverConnection) {
      serverConnection.sendWebRTCSignal({
        type: 'candidate',
        candidate
      });
    }
  });

  // Input from renderer (via data channel)
  ipcMain.on('webrtc:input', async (event, inputData) => {
    // Log only non-mousemove and non-mousedrag to reduce spam
    if (inputData.type !== 'mousemove' && inputData.type !== 'mousedrag') {
      console.log('[Main] <<<< Received input via IPC:', inputData.type, inputData);
    }

    if (!inputInjection) {
      console.error('[Main] InputInjection NOT initialized!');
      return;
    }

    try {
      switch (inputData.type) {
        case 'mousemove':
          // Coordinates are already normalized (0-1) from dashboard
          await inputInjection.moveMouse(inputData.x, inputData.y);
          break;

        case 'mousedown':
          // Mouse button pressed (start of potential drag)
          console.log(`[Main] >>> MOUSEDOWN ${inputData.button} at (${inputData.x.toFixed(2)}, ${inputData.y.toFixed(2)})`);
          await inputInjection.mouseDown(inputData.x, inputData.y, inputData.button);
          break;

        case 'mouseup':
          // Mouse button released (end of drag or click)
          console.log(`[Main] >>> MOUSEUP ${inputData.button} at (${inputData.x.toFixed(2)}, ${inputData.y.toFixed(2)})`);
          await inputInjection.mouseUp(inputData.x, inputData.y, inputData.button);
          break;

        case 'mousedrag':
          // Mouse moved while button is pressed (dragging)
          await inputInjection.moveMouse(inputData.x, inputData.y);
          break;

        case 'click':
          // Quick click (mousedown + mouseup within threshold)
          console.log(`[Main] >>> CLICK ${inputData.button} at (${inputData.x.toFixed(2)}, ${inputData.y.toFixed(2)})`);
          await inputInjection.click(inputData.x, inputData.y, inputData.button);
          break;

        case 'doubleclick':
          // Simulate double click as two rapid clicks
          console.log(`[Main] >>> DOUBLE CLICK at (${inputData.x.toFixed(2)}, ${inputData.y.toFixed(2)})`);
          await inputInjection.click(inputData.x, inputData.y, 'left');
          await new Promise(resolve => setTimeout(resolve, 50));
          await inputInjection.click(inputData.x, inputData.y, 'left');
          break;

        case 'keypress':
          console.log(`[Main] >>> KEY ${inputData.key} (ctrl=${inputData.ctrl}, shift=${inputData.shift}, alt=${inputData.alt})`);
          await inputInjection.keyPress(inputData.key, {
            ctrl: inputData.ctrl,
            shift: inputData.shift,
            alt: inputData.alt,
            meta: inputData.meta
          });
          break;

        default:
          console.warn('[Main] Unknown input type:', inputData.type);
      }
    } catch (error) {
      console.error('[Main] Error handling input:', error);
    }
  });

  // Connection state changes
  ipcMain.on('webrtc:connectionstate', (event, state) => {
    console.log('[Main] WebRTC connection state:', state);
  });

  // Errors
  ipcMain.on('webrtc:error', (event, errorMessage) => {
    console.error('[Main] WebRTC renderer error:', errorMessage);
  });

  webrtcHandlersSetup = true;
  console.log('[Main] WebRTC IPC handlers setup complete');
}

function quitApp() {
  // Disconnetti dal server
  if (serverConnection) {
    serverConnection.disconnect();
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
  if (serverConnection) {
    serverConnection.disconnect();
  }
  if (inputInjection) {
    inputInjection.cleanup();
  }
  if (inputBlockProcess) {
    inputBlockProcess.kill();
  }
});

// Previeni suspend/sleep
app.on('browser-window-blur', () => {
  if (mainWindow) {
    mainWindow.focus();
  }
});
