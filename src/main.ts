import { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import { ServerConnection } from './serverConnection';
import { InputInjection } from './inputInjection';
import { FileManager } from './fileManager';
import { sendWindowsNotification } from './notification';
import { startBlockedWebServer, stopBlockedWebServer } from './proxyServer';

// Carica variabili d'ambiente dal file .env
dotenv.config();

let mainWindow: BrowserWindow | null = null;
let serverConnection: ServerConnection | null = null;
let webrtcWindow: BrowserWindow | null = null;
let inputInjection: InputInjection | null = null;
let isLocked = false;
let isInternetBlocked = false;

// Configurazione
const EXIT_PASSWORD = process.env.EXIT_PASSWORD || 'admin123';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const STANDALONE_MODE = process.env.STANDALONE_MODE === 'true'; // Se true, non si connette al server
let passwordBuffer = '';

console.log('[Config] SERVER_URL:', SERVER_URL);
console.log('[Config] STANDALONE_MODE:', STANDALONE_MODE);

// ========== ALCATRAZ MODE: Windows Firewall Control ==========
const FIREWALL_RULE_NAME = 'KioskInternetBlock';

function enableFirewallBlock() {
  console.log('[Firewall] Enabling internet block via netsh...');

  // Extract server IP from SERVER_URL
  let serverHost = 'localhost';
  try {
    const url = new URL(SERVER_URL);
    serverHost = url.hostname;
  } catch (e) {
    console.error('[Firewall] Failed to parse SERVER_URL, using localhost');
  }

  // Use netsh to:
  // 1. Set default outbound policy to BLOCK
  // 2. Add exception for kiosk server
  const commands = [
    // First add allow rules (before blocking)
    `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}_AllowServer" dir=out action=allow remoteip=${serverHost}`,
    `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}_AllowLocalhost" dir=out action=allow remoteip=127.0.0.1`,
    `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}_AllowDNS" dir=out action=allow protocol=udp remoteport=53`,
    // Allow inbound connections on port 80 (for local web server)
    `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}_AllowPort80" dir=in action=allow protocol=tcp localport=80`,
    // Then set default policy to block all outbound
    `netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound`,
  ];

  // Execute commands sequentially
  const execCommand = (index: number) => {
    if (index >= commands.length) {
      console.log('[Firewall] All commands executed - Block ENABLED');

      // Start local web server on port 80
      startBlockedWebServer();

      // Modify Windows hosts file to redirect ALL common domains to localhost
      const hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

      // Comprehensive list of domains to block
      const domains = [
        'google.com', 'www.google.com', 'google.it', 'www.google.it',
        'bing.com', 'www.bing.com',
        'yahoo.com', 'www.yahoo.com',
        'duckduckgo.com', 'www.duckduckgo.com',
        'facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com',
        'youtube.com', 'www.youtube.com', 'youtu.be',
        'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
        'instagram.com', 'www.instagram.com',
        'tiktok.com', 'www.tiktok.com',
        'reddit.com', 'www.reddit.com',
        'linkedin.com', 'www.linkedin.com',
        'whatsapp.com', 'www.whatsapp.com', 'web.whatsapp.com',
        'office.com', 'www.office.com', 'office365.com', 'www.office365.com',
        'microsoft.com', 'www.microsoft.com',
        'amazon.com', 'www.amazon.com', 'amazon.it', 'www.amazon.it',
        'wikipedia.org', 'www.wikipedia.org', 'it.wikipedia.org',
        'netflix.com', 'www.netflix.com',
        'twitch.tv', 'www.twitch.tv',
        'discord.com', 'www.discord.com',
        'github.com', 'www.github.com',
        'stackoverflow.com', 'www.stackoverflow.com'
      ];

      // Build all entries as a single string
      const hostsEntries = '# Kiosk Internet Block - START\n' +
        domains.map(domain => `127.0.0.1 ${domain}`).join('\n') +
        '\n# Kiosk Internet Block - END\n';

      // Write to temp file first, then append to hosts file in one operation
      const tempFile = path.join(os.tmpdir(), 'kiosk_hosts_temp.txt');
      fsSync.writeFileSync(tempFile, hostsEntries, 'utf-8');

      // Use PowerShell to append the temp file content to hosts file
      exec(`powershell -Command "Get-Content '${tempFile}' | Add-Content -Path '${hostsPath}'"`, (err) => {
        if (err) {
          console.error('[Hosts] Error modifying hosts file:', err.message);
        } else {
          console.log(`[Hosts] Hosts file modified - ${domains.length} domains redirected to localhost`);
        }
        // Clean up temp file
        try { fsSync.unlinkSync(tempFile); } catch (e) { }
      });

      // After firewall is enabled, show blocked page
      showBlockedPageInBrowser();
      return;
    }

    exec(commands[index], (error, stdout, stderr) => {
      if (error) {
        console.error(`[Firewall] Command ${index} error:`, error.message);
      } else {
        console.log(`[Firewall] Command ${index} OK:`, commands[index].substring(0, 50) + '...');
      }
      execCommand(index + 1);
    });
  };

  execCommand(0);
}

// Kill all browsers and open blocked page
function showBlockedPageInBrowser() {
  console.log('[Browser] Killing browsers and showing blocked page...');

  // Path to blocked.html
  const blockedPagePath = path.join(__dirname, '../renderer/blocked.html').replace(/\\/g, '/');
  const fileUrl = `file:///${blockedPagePath}`;

  // Kill all major browsers
  const killCommands = [
    'taskkill /F /IM chrome.exe 2>nul',
    'taskkill /F /IM msedge.exe 2>nul',
    'taskkill /F /IM firefox.exe 2>nul',
    'taskkill /F /IM opera.exe 2>nul',
    'taskkill /F /IM brave.exe 2>nul',
  ];

  // Execute all kill commands, then open page
  const killCmd = killCommands.join(' & ');

  exec(killCmd, (error) => {
    // Ignore errors (browser might not be running)
    console.log('[Browser] Browsers killed, opening blocked page...');

    // Wait a moment for browsers to close, then open blocked page
    setTimeout(() => {
      // Open blocked page in default browser
      exec(`start "" "${fileUrl}"`, (err) => {
        if (err) {
          console.error('[Browser] Error opening blocked page:', err.message);
        } else {
          console.log('[Browser] Blocked page opened successfully');
        }
      });

      // Send Windows notification
      sendWindowsNotification('Rete Bloccata', 'Accesso a Internet disabilitato.');
    }, 500);
  });
}

function disableFirewallBlock() {
  console.log('[Firewall] Disabling internet block...');

  // Stop web server
  stopBlockedWebServer();

  // Clean up hosts file - remove Kiosk entries
  const hostsPath = 'C:\\\\Windows\\\\System32\\\\drivers\\\\etc\\\\hosts';
  exec(`powershell -Command "(Get-Content '${hostsPath}') | Where-Object { $_ -notmatch 'Kiosk Internet Block' -and $_ -notmatch '127.0.0.1 google' -and $_ -notmatch '127.0.0.1 www.google' -and $_ -notmatch '127.0.0.1 bing' -and $_ -notmatch '127.0.0.1 www.bing' -and $_ -notmatch '127.0.0.1 facebook' -and $_ -notmatch '127.0.0.1 www.facebook' -and $_ -notmatch '127.0.0.1 youtube' -and $_ -notmatch '127.0.0.1 www.youtube' -and $_ -notmatch '127.0.0.1 twitter' -and $_ -notmatch '127.0.0.1 www.twitter' -and $_ -notmatch '127.0.0.1 instagram' -and $_ -notmatch '127.0.0.1 www.instagram' -and $_ -notmatch '127.0.0.1 office' -and $_ -notmatch '127.0.0.1 www.office' -and $_ -notmatch '127.0.0.1 microsoft' -and $_ -notmatch '127.0.0.1 www.microsoft' } | Set-Content '${hostsPath}'"`, (err) => {
    if (err) console.error('[Hosts] Error cleaning hosts file:', err.message);
    else console.log('[Hosts] Hosts file cleaned');
  });

  const commands = [
    // Restore default policy (allow outbound)
    `netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound`,
    // Remove our rules
    `netsh advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}_AllowServer"`,
    `netsh advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}_AllowLocalhost"`,
    `netsh advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}_AllowDNS"`,
    `netsh advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}_AllowPort80"`,
  ];

  commands.forEach((cmd, i) => {
    exec(cmd, (error) => {
      if (error) {
        console.error(`[Firewall] Cleanup ${i} error:`, error.message);
      }
    });
  });

  console.log('[Firewall] Block DISABLED');

  // Show unblocked page
  showUnblockedPageInBrowser();

  // Send Windows notification
  sendWindowsNotification('Connessione Ripristinata', 'Accesso a Internet riabilitato.');
}

// Show unblocked page when internet is restored
function showUnblockedPageInBrowser() {
  console.log('[Browser] Opening unblocked page...');

  const unblockedPagePath = path.join(__dirname, '../renderer/unblocked.html').replace(/\\/g, '/');
  const fileUrl = `file:///${unblockedPagePath}`;

  exec(`start "" "${fileUrl}"`, (err) => {
    if (err) {
      console.error('[Browser] Error opening unblocked page:', err.message);
    } else {
      console.log('[Browser] Unblocked page opened successfully');
    }
  });
}


// Cleanup on exit - always restore normal policy and stop web server
app.on('will-quit', () => {
  if (process.platform === 'win32' && isInternetBlocked) {
    console.log('[Cleanup] Restoring firewall settings and stopping web server...');

    // Stop web server
    stopBlockedWebServer();

    try {
      // Restore firewall policy
      require('child_process').execSync(
        `netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound`,
        { stdio: 'ignore' }
      );
    } catch (e) {
      // Ignore errors on cleanup
    }
  }
});

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


  // Previeni navigazione (Internet Block Logic)
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isInternetBlocked) {
      // If we are already on the blocked page, don't loop
      if (url.includes('blocked.html')) return;

      console.log('[Main] Navigation BLOCKED due to restriction:', url);
      e.preventDefault();
      mainWindow?.loadFile(path.join(__dirname, '../renderer/blocked.html'));
    } else {
      // Allow navigation if not blocked
      console.log('[Main] Navigation Allowed:', url);
    }
  });

  // ALCATRAZ MODE: Block ALL network requests when internet is blocked
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      if (isInternetBlocked) {
        // Allow only local files (file://)
        if (details.url.startsWith('file://')) {
          callback({ cancel: false });
        } else {
          console.log('[Main] Network request BLOCKED:', details.url);
          callback({ cancel: true });

          // If this is a main frame navigation, redirect to blocked page
          if (details.resourceType === 'mainFrame') {
            mainWindow?.loadFile(path.join(__dirname, '../renderer/blocked.html'));
          }
        }
      } else {
        // Allow all requests when not blocked
        callback({ cancel: false });
      }
    }
  );

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

  // File system operation handlers
  serverConnection.on('server:fs-list', async (data: { dirPath: string; requestId: string }) => {
    console.log('[Main] File Explorer: List directory', data.dirPath);
    try {
      const result = await FileManager.listDir(data.dirPath);
      serverConnection.sendFsListResponse(data.requestId, result);
    } catch (error: any) {
      console.error('[Main] Error listing directory:', error.message);
      serverConnection.sendFsListResponse(data.requestId, undefined, error.message);
    }
  });

  serverConnection.on('server:fs-get-disks', async (data: { requestId: string }) => {
    console.log('[Main] File Explorer: Get Disks');
    try {
      const disks = await FileManager.getDisks();
      serverConnection.sendFsGetDisksResponse(data.requestId, disks);
    } catch (error: any) {
      console.error('[Main] Error getting disks:', error.message);
      serverConnection.sendFsGetDisksResponse(data.requestId, undefined, error.message);
    }
  });

  serverConnection.on('server:fs-rename', async (data: { oldPath: string; newPath: string; requestId: string }) => {
    console.log('[Main] File Explorer: Rename', data.oldPath, 'to', data.newPath);
    try {
      await FileManager.rename(data.oldPath, data.newPath);
      serverConnection.sendFsRenameResponse(data.requestId);
    } catch (error: any) {
      console.error('[Main] Error renaming:', error.message);
      serverConnection.sendFsRenameResponse(data.requestId, error.message);
    }
  });

  serverConnection.on('server:fs-read', async (data: { filePath: string; requestId: string }) => {
    console.log('[Main] File Explorer: Read file', data.filePath);
    try {
      const content = await fs.readFile(data.filePath, 'utf-8');
      serverConnection.sendFsReadResponse(data.requestId, { content });
    } catch (error: any) {
      console.error('[Main] Error reading file:', error.message);
      serverConnection.sendFsReadResponse(data.requestId, undefined, error.message);
    }
  });

  serverConnection.on('server:fs-write', async (data: { filePath: string; content: string; requestId: string }) => {
    console.log('[Main] File Explorer: Write file', data.filePath);
    try {
      await fs.writeFile(data.filePath, data.content, 'utf-8');
      serverConnection.sendFsWriteResponse(data.requestId);
    } catch (error: any) {
      console.error('[Main] Error writing file:', error.message);
      serverConnection.sendFsWriteResponse(data.requestId, error.message);
    }
  });

  serverConnection.on('server:fs-delete', async (data: { targetPath: string; requestId: string }) => {
    console.log('[Main] File Explorer: Delete', data.targetPath);
    try {
      const stats = await fs.stat(data.targetPath);
      if (stats.isDirectory()) {
        await fs.rm(data.targetPath, { recursive: true, force: true });
      } else {
        await fs.unlink(data.targetPath);
      }
      serverConnection.sendFsDeleteResponse(data.requestId);
    } catch (error: any) {
      console.error('[Main] Error deleting:', error.message);
      serverConnection.sendFsDeleteResponse(data.requestId, error.message);
    }
  });

  serverConnection.on('server:fs-move', async (data: { sourcePath: string; destPath: string; requestId: string }) => {
    console.log('[Main] File Explorer: Move', data.sourcePath, 'to', data.destPath);
    try {
      await fs.rename(data.sourcePath, data.destPath);
      serverConnection.sendFsMoveResponse(data.requestId);
    } catch (error: any) {
      console.error('[Main] Error moving:', error.message);
      serverConnection.sendFsMoveResponse(data.requestId, error.message);
    }
  });

  serverConnection.on('server:fs-copy', async (data: { sourcePath: string; destPath: string; requestId: string }) => {
    console.log('[Main] File Explorer: Copy', data.sourcePath, 'to', data.destPath);
    try {
      const stats = await fs.stat(data.sourcePath);
      if (stats.isDirectory()) {
        await fs.cp(data.sourcePath, data.destPath, { recursive: true });
      } else {
        await fs.copyFile(data.sourcePath, data.destPath);
      }
      serverConnection.sendFsCopyResponse(data.requestId);
    } catch (error: any) {
      console.error('[Main] Error copying:', error.message);
      serverConnection.sendFsCopyResponse(data.requestId, error.message);
    }
  });

  serverConnection.on('server:fs-mkdir', async (data: { dirPath: string; requestId: string }) => {
    console.log('[Main] File Explorer: Create directory', data.dirPath);
    try {
      await fs.mkdir(data.dirPath, { recursive: true });
      serverConnection.sendFsMkdirResponse(data.requestId);
    } catch (error: any) {
      console.error('[Main] Error creating directory:', error.message);
      serverConnection.sendFsMkdirResponse(data.requestId, error.message);
    }
  });

  serverConnection.onExecuteVbs(async (scriptContent: string) => {
    console.log('[Main] Executing VBS Alert...');
    try {
      // Create temp file
      const tempDir = os.tmpdir();
      const fileName = `alert_${Date.now()}.vbs`;
      const filePath = path.join(tempDir, fileName);

      await fs.writeFile(filePath, scriptContent, 'utf-8');

      console.log('[Main] VBS saved to:', filePath);

      // Execute
      exec(`wscript //Nologo "${filePath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('[Main] Error executing VBS:', error);
        } else {
          console.log('[Main] VBS executed successfully');
        }

        // Cleanup after short delay (to ensure execution started)
        setTimeout(() => {
          fs.unlink(filePath).catch(err => console.error('Error deleting temp vbs:', err));
        }, 2000);
      });

    } catch (err: any) {
      console.error('[Main] Failed to handle VBS execution:', err);
    }
  });

  serverConnection.onBlockInternet((block: boolean) => {
    console.log(`[Main] Internet Block set to: ${block}`);
    isInternetBlocked = block;

    // ALCATRAZ MODE: Use Windows Firewall to block ALL internet traffic
    if (process.platform === 'win32') {
      if (block) {
        enableFirewallBlock();
      } else {
        disableFirewallBlock();
      }
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
});

// Previeni suspend/sleep
app.on('browser-window-blur', () => {
  if (mainWindow) {
    mainWindow.focus();
  }
});
