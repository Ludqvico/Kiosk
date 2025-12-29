import { io, Socket } from 'socket.io-client';
import * as os from 'os';

export class ServerConnection {
  private socket: Socket | null = null;
  private serverUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private onLockCallback: (() => void) | null = null;
  private onUnlockCallback: (() => void) | null = null;
  private onRebootCallback: (() => void) | null = null;
  private onShutdownCallback: ((delay: number) => void) | null = null;
  private onLogoutCallback: (() => void) | null = null;
  private onWebRTCStartCallback: (() => void) | null = null;
  private onWebRTCStopCallback: (() => void) | null = null;
  private onWebRTCSignalCallback: ((signal: any) => void) | null = null;

  constructor(serverUrl: string = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  connect() {
    console.log(`[ServerConnection] Connessione a ${this.serverUrl}...`);

    this.socket = io(this.serverUrl, {
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // Connessione riuscita
    this.socket.on('connect', () => {
      console.log('[ServerConnection] Connesso al server');
      this.reconnectAttempts = 0;

      // Registra questo client
      this.registerClient();

      // Invia heartbeat ogni 30 secondi
      this.startHeartbeat();
    });

    // Errore di connessione
    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error(`[ServerConnection] ✗ Errore connessione (tentativo ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[ServerConnection] Numero massimo di tentativi raggiunto. Modalità offline.');
      }
    });

    // Disconnessione
    this.socket.on('disconnect', (reason) => {
      console.log('[ServerConnection] Disconnesso:', reason);
    });

    // Riconnessione
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[ServerConnection] Riconnesso dopo ${attemptNumber} tentativi`);
    });

    // Comandi dal server
    this.socket.on('server:lock', () => {
      console.log('[ServerConnection] Ricevuto comando LOCK dal server');
      if (this.onLockCallback) {
        this.onLockCallback();
      }
    });

    this.socket.on('server:unlock', () => {
      console.log('[ServerConnection] Ricevuto comando UNLOCK dal server');
      if (this.onUnlockCallback) {
        this.onUnlockCallback();
      }
    });

    // Comando reboot
    this.socket.on('server:reboot', () => {
      console.log('[ServerConnection] Ricevuto comando REBOOT dal server');
      if (this.onRebootCallback) {
        this.onRebootCallback();
      }
    });

    // Richiesta diagnostica
    this.socket.on('server:request-diagnostics', () => {
      console.log('[ServerConnection] Ricevuta richiesta DIAGNOSTICS dal server');
      this.sendDiagnostics();
    });

    // Comando shutdown
    this.socket.on('server:shutdown', (data: { delay: number }) => {
      console.log(`[ServerConnection] Ricevuto comando SHUTDOWN dal server (delay: ${data.delay}s)`);
      if (this.onShutdownCallback) {
        this.onShutdownCallback(data.delay);
      }
    });

    // Comando logout
    this.socket.on('server:logout', () => {
      console.log('[ServerConnection] Ricevuto comando LOGOUT dal server');
      if (this.onLogoutCallback) {
        this.onLogoutCallback();
      }
    });

    // WebRTC remote desktop handlers
    this.socket.on('server:webrtc-start', () => {
      console.log('[ServerConnection] Ricevuto comando START WEBRTC REMOTE DESKTOP dal server');
      if (this.onWebRTCStartCallback) {
        this.onWebRTCStartCallback();
      }
    });

    this.socket.on('server:webrtc-stop', () => {
      console.log('[ServerConnection] Ricevuto comando STOP WEBRTC REMOTE DESKTOP dal server');
      if (this.onWebRTCStopCallback) {
        this.onWebRTCStopCallback();
      }
    });

    this.socket.on('server:webrtc-signal', (signal: any) => {
      console.log('[ServerConnection] Ricevuto segnale WebRTC dal server:', signal.type);
      if (this.onWebRTCSignalCallback) {
        this.onWebRTCSignalCallback(signal);
      }
    });

    // File system operation handlers (forwarded from main.ts handlers)
    // These are just pass-through, actual logic is in main.ts
  }

  private registerClient() {
    if (!this.socket) return;

    const hostname = os.hostname();
    const platform = process.platform;

    this.socket.emit('client:register', {
      hostname,
      platform
    });

    console.log(`[ServerConnection] Client registrato: ${hostname} (${platform})`);
  }

  private startHeartbeat() {
    setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('client:heartbeat');
      }
    }, 30000); // Ogni 30 secondi
  }

  // Invia aggiornamento stato al server
  sendStatus(locked: boolean) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:status', { locked });
      console.log(`[ServerConnection] Stato inviato al server: ${locked ? 'LOCKED' : 'UNLOCKED'}`);
    }
  }

  // Registra callback per comando lock
  onLock(callback: () => void) {
    this.onLockCallback = callback;
  }

  // Registra callback per comando unlock
  onUnlock(callback: () => void) {
    this.onUnlockCallback = callback;
  }

  // Registra callback per comando reboot
  onReboot(callback: () => void) {
    this.onRebootCallback = callback;
  }

  // Registra callback per comando shutdown
  onShutdown(callback: (delay: number) => void) {
    this.onShutdownCallback = callback;
  }

  // Registra callback per comando logout
  onLogout(callback: () => void) {
    this.onLogoutCallback = callback;
  }

  // Invia diagnostica al server
  private sendDiagnostics() {
    if (!this.socket || !this.socket.connected) return;

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2);

    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = (100 - (100 * totalIdle / totalTick)).toFixed(2);

    const diagnostics = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      cpuUsage: parseFloat(cpuUsage),
      totalMemoryMB: Math.round(totalMemory / 1024 / 1024),
      usedMemoryMB: Math.round(usedMemory / 1024 / 1024),
      freeMemoryMB: Math.round(freeMemory / 1024 / 1024),
      memoryUsage: parseFloat(memoryUsage),
      uptime: Math.round(os.uptime()),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    };

    this.socket.emit('client:diagnostics', diagnostics);
    console.log('[ServerConnection] Diagnostica inviata al server:', diagnostics);
  }

  // Disconnetti dal server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[ServerConnection] Disconnesso dal server');
    }
  }

  // Verifica se connesso
  isConnected(): boolean {
    return this.socket ? this.socket.connected : false;
  }

  // ========== REMOTE DESKTOP (WebRTC) ==========

  // Registra callback per avvio remote desktop
  onWebRTCStart(callback: () => void) {
    this.onWebRTCStartCallback = callback;
  }

  // Registra callback per stop remote desktop
  onWebRTCStop(callback: () => void) {
    this.onWebRTCStopCallback = callback;
  }

  // Registra callback per segnali WebRTC
  onWebRTCSignal(callback: (signal: any) => void) {
    this.onWebRTCSignalCallback = callback;
  }

  // Invia segnale WebRTC al server
  sendWebRTCSignal(signal: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:webrtc-signal', signal);
    }
  }

  // ========== FILE SYSTEM OPERATIONS ==========

  // File system response handlers
  sendFsListResponse(requestId: string, result?: any, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-list-response', { requestId, result, error });
    }
  }

  sendFsReadResponse(requestId: string, result?: any, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-read-response', { requestId, result, error });
    }
  }

  sendFsWriteResponse(requestId: string, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-write-response', { requestId, error });
    }
  }

  sendFsDeleteResponse(requestId: string, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-delete-response', { requestId, error });
    }
  }

  sendFsMoveResponse(requestId: string, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-move-response', { requestId, error });
    }
  }

  sendFsCopyResponse(requestId: string, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-copy-response', { requestId, error });
    }
  }

  sendFsMkdirResponse(requestId: string, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-mkdir-response', { requestId, error });
    }
  }

  sendFsGetDisksResponse(requestId: string, disks?: any[], error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-get-disks-response', { requestId, disks, error });
    }
  }

  sendFsRenameResponse(requestId: string, error?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client:fs-rename-response', { requestId, error });
    }
  }

  // Allow main.ts to register custom socket event listeners
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }
}
