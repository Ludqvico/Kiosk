import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Struttura per tracciare i client connessi
interface KioskClient {
  id: string;
  hostname: string;
  platform: string;
  locked: boolean;
  connectedAt: Date;
  lastSeen: Date;
}

// Struttura per Activity Log
interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: 'client_connected' | 'client_disconnected' | 'lock' | 'unlock' | 'lock_all' | 'unlock_all' | 'reboot' | 'shutdown' | 'logout' | 'diagnostics';
  clientId?: string;
  clientHostname?: string;
  adminId?: string;
  details?: string;
}

const connectedClients = new Map<string, KioskClient>();
const activityLog: ActivityEvent[] = [];
let eventIdCounter = 0;

// WebRTC signaling state
// Map<clientId, adminSocketId> - tracks active remote desktop sessions
const activeWebRTCSessions = new Map<string, string>();

// Helper per loggare eventi
function logActivity(event: Omit<ActivityEvent, 'id' | 'timestamp'>) {
  const activityEvent: ActivityEvent = {
    id: `evt_${++eventIdCounter}`,
    timestamp: new Date(),
    ...event
  };

  activityLog.push(activityEvent);

  // Limita a 10000 eventi (evita memory leak)
  if (activityLog.length > 10000) {
    activityLog.shift();
  }

  // Notifica in tempo reale agli admin
  io.emit('admin:activity-event', activityEvent);

  console.log(`[Activity Log] ${activityEvent.type} - ${activityEvent.clientHostname || 'N/A'}`);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Route per la dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// API per autenticazione admin (semplice, da migliorare in produzione)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({
      success: true,
      token: 'simple-auth-token' // In produzione usa JWT reale
    });
  } else {
    res.status(401).json({ success: false, message: 'Credenziali non valide' });
  }
});

// API per ottenere lista client
app.get('/api/clients', (req, res) => {
  const clients = Array.from(connectedClients.values()).map(client => ({
    ...client,
    connectedAt: client.connectedAt.toISOString(),
    lastSeen: client.lastSeen.toISOString()
  }));

  res.json(clients);
});

// API per ottenere activity log
app.get('/api/activity-log', (req, res) => {
  const { type, clientId, startDate, endDate, limit } = req.query;

  let filteredLog = [...activityLog];

  // Filtro per tipo
  if (type && type !== 'all') {
    filteredLog = filteredLog.filter(e => e.type === type);
  }

  // Filtro per client
  if (clientId && clientId !== 'all') {
    filteredLog = filteredLog.filter(e => e.clientId === clientId);
  }

  // Filtro per data
  if (startDate) {
    const start = new Date(startDate as string);
    filteredLog = filteredLog.filter(e => e.timestamp >= start);
  }

  if (endDate) {
    const end = new Date(endDate as string);
    filteredLog = filteredLog.filter(e => e.timestamp <= end);
  }

  // Ordina dal più recente al più vecchio
  filteredLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Limita risultati
  const maxLimit = limit ? parseInt(limit as string) : 1000;
  filteredLog = filteredLog.slice(0, maxLimit);

  res.json(filteredLog);
});

// API per export CSV
app.get('/api/activity-log/export', (req, res) => {
  const { type, clientId, startDate, endDate } = req.query;

  let filteredLog = [...activityLog];

  // Applica stessi filtri
  if (type && type !== 'all') {
    filteredLog = filteredLog.filter(e => e.type === type);
  }

  if (clientId && clientId !== 'all') {
    filteredLog = filteredLog.filter(e => e.clientId === clientId);
  }

  if (startDate) {
    const start = new Date(startDate as string);
    filteredLog = filteredLog.filter(e => e.timestamp >= start);
  }

  if (endDate) {
    const end = new Date(endDate as string);
    filteredLog = filteredLog.filter(e => e.timestamp <= end);
  }

  filteredLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Genera CSV
  const csvHeader = 'ID,Timestamp,Type,Client ID,Client Hostname,Details\n';
  const csvRows = filteredLog.map(e => {
    const timestamp = e.timestamp.toISOString();
    const clientHostname = (e.clientHostname || '').replace(/,/g, ';');
    const details = (e.details || '').replace(/,/g, ';');
    return `${e.id},${timestamp},${e.type},${e.clientId || ''},${clientHostname},${details}`;
  }).join('\n');

  const csv = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=activity-log-${new Date().toISOString()}.csv`);
  res.send(csv);
});

// Socket.io - Gestione connessioni
io.on('connection', (socket) => {
  console.log(`[Socket.io] Nuova connessione: ${socket.id}`);

  // Registrazione client kiosk
  socket.on('client:register', (data: { hostname: string; platform: string }) => {
    console.log(`[Client] Registrato: ${data.hostname} (${data.platform})`);

    const client: KioskClient = {
      id: socket.id,
      hostname: data.hostname,
      platform: data.platform,
      locked: false,
      connectedAt: new Date(),
      lastSeen: new Date()
    };

    connectedClients.set(socket.id, client);

    // Log activity
    logActivity({
      type: 'client_connected',
      clientId: socket.id,
      clientHostname: data.hostname,
      details: `Platform: ${data.platform}`
    });

    // Notifica tutti gli admin della nuova connessione
    io.emit('admin:client-connected', client);
  });

  // Heartbeat dal client
  socket.on('client:heartbeat', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.lastSeen = new Date();
    }
  });

  // Aggiornamento stato lock dal client
  socket.on('client:status', (data: { locked: boolean }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.locked = data.locked;
      client.lastSeen = new Date();

      // Notifica gli admin
      io.emit('admin:client-status', {
        clientId: socket.id,
        locked: data.locked
      });
    }
  });

  // Comandi dall'admin ai client
  socket.on('admin:lock-client', (clientId: string) => {
    console.log(`[Admin] Richiesta lock per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      io.to(clientId).emit('server:lock');
      console.log(`[Server] Comando LOCK inviato a ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'lock',
        clientId: clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: `Locked by admin`
      });
    }
  });

  socket.on('admin:unlock-client', (clientId: string) => {
    console.log(`[Admin] Richiesta unlock per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      io.to(clientId).emit('server:unlock');
      console.log(`[Server] Comando UNLOCK inviato a ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'unlock',
        clientId: clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: `Unlocked by admin`
      });
    }
  });

  socket.on('admin:lock-all', () => {
    console.log('[Admin] Richiesta LOCK per tutti i client');
    io.emit('server:lock');

    // Log activity
    logActivity({
      type: 'lock_all',
      adminId: socket.id,
      details: `Locked all clients (${connectedClients.size} total)`
    });
  });

  socket.on('admin:unlock-all', () => {
    console.log('[Admin] Richiesta UNLOCK per tutti i client');
    io.emit('server:unlock');

    // Log activity
    logActivity({
      type: 'unlock_all',
      adminId: socket.id,
      details: `Unlocked all clients (${connectedClients.size} total)`
    });
  });

  // Reboot client
  socket.on('admin:reboot-client', (clientId: string) => {
    console.log(`[Admin] Richiesta REBOOT per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      io.to(clientId).emit('server:reboot');
      console.log(`[Server] Comando REBOOT inviato a ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'reboot',
        clientId: clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: `Reboot requested by admin`
      });
    }
  });

  // Richiesta diagnostica client
  socket.on('admin:request-diagnostics', (clientId: string) => {
    console.log(`[Admin] Richiesta DIAGNOSTICS per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      io.to(clientId).emit('server:request-diagnostics', { requesterId: socket.id });
      console.log(`[Server] Richiesta diagnostics inviata a ${client.hostname}`);
    }
  });

  // Risposta diagnostica dal client
  socket.on('client:diagnostics', (data: any) => {
    console.log(`[Client] Diagnostics ricevuti da: ${socket.id}`);

    const client = connectedClients.get(socket.id);
    if (client) {
      // Inoltra diagnostica all'admin che l'ha richiesta
      io.emit('admin:diagnostics-response', {
        clientId: socket.id,
        clientHostname: client.hostname,
        diagnostics: data
      });

      // Log activity
      logActivity({
        type: 'diagnostics',
        clientId: socket.id,
        clientHostname: client.hostname,
        details: `CPU: ${data.cpuUsage}%, RAM: ${data.memoryUsage}%, Uptime: ${data.uptime}s`
      });
    }
  });

  // Shutdown client
  socket.on('admin:shutdown-client', (data: { clientId: string; delay: number }) => {
    console.log(`[Admin] Richiesta SHUTDOWN per client: ${data.clientId} con delay: ${data.delay}s`);

    const client = connectedClients.get(data.clientId);
    if (client) {
      io.to(data.clientId).emit('server:shutdown', { delay: data.delay });
      console.log(`[Server] Comando SHUTDOWN inviato a ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'shutdown',
        clientId: data.clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: data.delay > 0 ? `Shutdown scheduled in ${data.delay}s` : `Immediate shutdown`
      });
    }
  });

  // Logout client
  socket.on('admin:logout-client', (clientId: string) => {
    console.log(`[Admin] Richiesta LOGOUT per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      io.to(clientId).emit('server:logout');
      console.log(`[Server] Comando LOGOUT inviato a ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'logout',
        clientId: clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: `Logout requested by admin`
      });
    }
  });

  // ========== REMOTE DESKTOP (WebRTC) ==========

  // Admin avvia sessione remote desktop
  socket.on('admin:start-remote-desktop', (clientId: string) => {
    console.log(`[Admin] Richiesta WEBRTC REMOTE DESKTOP per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      // Verifica se già in remote desktop
      if (activeWebRTCSessions.has(clientId)) {
        const existingAdminId = activeWebRTCSessions.get(clientId);
        socket.emit('admin:remote-desktop-error', {
          message: `Client già sotto controllo remoto da altro admin (${existingAdminId})`
        });
        return;
      }

      // Registra sessione
      activeWebRTCSessions.set(clientId, socket.id);

      // Avvia WebRTC sul client
      io.to(clientId).emit('server:webrtc-start');
      console.log(`[Server] WebRTC remote desktop avviato su ${client.hostname}`);

      // Conferma all'admin
      socket.emit('admin:remote-desktop-started', { clientId });

      // Log activity
      logActivity({
        type: 'diagnostics',
        clientId: clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: `WebRTC remote desktop session started`
      });
    } else {
      socket.emit('admin:remote-desktop-error', {
        message: `Client ${clientId} non trovato`
      });
    }
  });

  // Admin ferma sessione remote desktop
  socket.on('admin:stop-remote-desktop', (clientId: string) => {
    console.log(`[Admin] Stop WEBRTC REMOTE DESKTOP per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      // Rimuovi sessione
      activeWebRTCSessions.delete(clientId);

      // Ferma WebRTC sul client
      io.to(clientId).emit('server:webrtc-stop');
      console.log(`[Server] WebRTC remote desktop fermato su ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'diagnostics',
        clientId: clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: `WebRTC remote desktop session stopped`
      });
    }
  });

  // Admin blocca/sblocca input del client
  socket.on('admin:block-client-input', (data: { clientId: string; block: boolean }) => {
    const { clientId, block } = data;
    console.log(`[Admin] ${block ? 'BLOCK' : 'UNBLOCK'} input per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      // Invia comando al client
      io.to(clientId).emit('server:block-input', block);
      console.log(`[Server] Input ${block ? 'bloccato' : 'sbloccato'} su ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'diagnostics',
        clientId: clientId,
        clientHostname: client.hostname,
        adminId: socket.id,
        details: `Client input ${block ? 'blocked' : 'unblocked'} by admin`
      });
    }
  });

  // WebRTC signaling: Admin -> Client
  socket.on('admin:webrtc-signal', (data: { clientId: string; signal: any }) => {
    const client = connectedClients.get(data.clientId);

    if (client && activeWebRTCSessions.get(data.clientId) === socket.id) {
      // Inoltra segnale al client
      io.to(data.clientId).emit('server:webrtc-signal', data.signal);
      console.log(`[WebRTC] Segnale admin->client: ${data.signal.type}`);
    }
  });

  // WebRTC signaling: Client -> Admin
  socket.on('client:webrtc-signal', (signal: any) => {
    const clientId = socket.id;
    const adminId = activeWebRTCSessions.get(clientId);

    if (adminId) {
      // Inoltra segnale all'admin
      io.to(adminId).emit('admin:webrtc-signal', {
        clientId: clientId,
        signal: signal
      });
      console.log(`[WebRTC] Segnale client->admin: ${signal.type}`);
    }
  });

  // ========== FILE EXPLORER ==========

  // List directory contents
  socket.on('admin:fs-list', async (data: { clientId: string; dirPath: string }, callback) => {
    const { clientId, dirPath } = data;
    console.log(`[Admin] File Explorer: List ${dirPath} on client ${clientId}`);

    try {
      // Forward request to client
      io.to(clientId).emit('server:fs-list', { dirPath, requestId: socket.id });
    } catch (error: any) {
      console.error(`[File Explorer] Error listing directory:`, error.message);
      callback?.({ error: error.message });
    }
  });

  // Client responds with directory listing
  socket.on('client:fs-list-response', (data: { requestId: string; result?: any; error?: string }) => {
    if (data.error) {
      io.to(data.requestId).emit('admin:fs-list-response', { error: data.error });
    } else {
      io.to(data.requestId).emit('admin:fs-list-response', { result: data.result });
    }
  });

  // Read file contents
  socket.on('admin:fs-read', async (data: { clientId: string; filePath: string }, callback) => {
    const { clientId, filePath } = data;
    console.log(`[Admin] File Explorer: Read ${filePath} on client ${clientId}`);

    try {
      io.to(clientId).emit('server:fs-read', { filePath, requestId: socket.id });
    } catch (error: any) {
      console.error(`[File Explorer] Error reading file:`, error.message);
      callback?.({ error: error.message });
    }
  });

  socket.on('client:fs-read-response', (data: { requestId: string; result?: any; error?: string }) => {
    if (data.error) {
      io.to(data.requestId).emit('admin:fs-read-response', { error: data.error });
    } else {
      io.to(data.requestId).emit('admin:fs-read-response', { result: data.result });
    }
  });

  // Write file
  socket.on('admin:fs-write', async (data: { clientId: string; filePath: string; content: string }, callback) => {
    const { clientId, filePath, content } = data;
    console.log(`[Admin] File Explorer: Write ${filePath} on client ${clientId}`);

    try {
      io.to(clientId).emit('server:fs-write', { filePath, content, requestId: socket.id });
    } catch (error: any) {
      console.error(`[File Explorer] Error writing file:`, error.message);
      callback?.({ error: error.message });
    }
  });

  socket.on('client:fs-write-response', (data: { requestId: string; error?: string }) => {
    if (data.error) {
      io.to(data.requestId).emit('admin:fs-write-response', { error: data.error });
    } else {
      io.to(data.requestId).emit('admin:fs-write-response', { success: true });
    }
  });

  // Delete file/folder
  socket.on('admin:fs-delete', async (data: { clientId: string; targetPath: string }, callback) => {
    const { clientId, targetPath } = data;
    console.log(`[Admin] File Explorer: Delete ${targetPath} on client ${clientId}`);

    try {
      io.to(clientId).emit('server:fs-delete', { targetPath, requestId: socket.id });
    } catch (error: any) {
      console.error(`[File Explorer] Error deleting:`, error.message);
      callback?.({ error: error.message });
    }
  });

  socket.on('client:fs-delete-response', (data: { requestId: string; error?: string }) => {
    if (data.error) {
      io.to(data.requestId).emit('admin:fs-delete-response', { error: data.error });
    } else {
      io.to(data.requestId).emit('admin:fs-delete-response', { success: true });
    }
  });

  // Move/Rename file/folder
  socket.on('admin:fs-move', async (data: { clientId: string; sourcePath: string; destPath: string }, callback) => {
    const { clientId, sourcePath, destPath } = data;
    console.log(`[Admin] File Explorer: Move ${sourcePath} to ${destPath} on client ${clientId}`);

    try {
      io.to(clientId).emit('server:fs-move', { sourcePath, destPath, requestId: socket.id });
    } catch (error: any) {
      console.error(`[File Explorer] Error moving:`, error.message);
      callback?.({ error: error.message });
    }
  });

  socket.on('client:fs-move-response', (data: { requestId: string; error?: string }) => {
    if (data.error) {
      io.to(data.requestId).emit('admin:fs-move-response', { error: data.error });
    } else {
      io.to(data.requestId).emit('admin:fs-move-response', { success: true });
    }
  });

  // Copy file/folder
  socket.on('admin:fs-copy', async (data: { clientId: string; sourcePath: string; destPath: string }, callback) => {
    const { clientId, sourcePath, destPath } = data;
    console.log(`[Admin] File Explorer: Copy ${sourcePath} to ${destPath} on client ${clientId}`);

    try {
      io.to(clientId).emit('server:fs-copy', { sourcePath, destPath, requestId: socket.id });
    } catch (error: any) {
      console.error(`[File Explorer] Error copying:`, error.message);
      callback?.({ error: error.message });
    }
  });

  socket.on('client:fs-copy-response', (data: { requestId: string; error?: string }) => {
    if (data.error) {
      io.to(data.requestId).emit('admin:fs-copy-response', { error: data.error });
    } else {
      io.to(data.requestId).emit('admin:fs-copy-response', { success: true });
    }
  });

  // Create directory
  socket.on('admin:fs-mkdir', async (data: { clientId: string; dirPath: string }, callback) => {
    const { clientId, dirPath } = data;
    console.log(`[Admin] File Explorer: Create directory ${dirPath} on client ${clientId}`);

    try {
      io.to(clientId).emit('server:fs-mkdir', { dirPath, requestId: socket.id });
    } catch (error: any) {
      console.error(`[File Explorer] Error creating directory:`, error.message);
      callback?.({ error: error.message });
    }
  });

  socket.on('client:fs-mkdir-response', (data: { requestId: string; error?: string }) => {
    if (data.error) {
      io.to(data.requestId).emit('admin:fs-mkdir-response', { error: data.error });
    } else {
      io.to(data.requestId).emit('admin:fs-mkdir-response', { success: true });
    }
  });

  // Disconnessione
  socket.on('disconnect', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      console.log(`[Client] Disconnesso: ${client.hostname}`);

      // Log activity
      logActivity({
        type: 'client_disconnected',
        clientId: socket.id,
        clientHostname: client.hostname,
        details: `Disconnected after ${Math.round((new Date().getTime() - client.connectedAt.getTime()) / 1000)}s`
      });

      connectedClients.delete(socket.id);

      // Notifica gli admin
      io.emit('admin:client-disconnected', { clientId: socket.id });
    }

    // Cleanup WebRTC sessions
    // Se era un admin che controllava un client, ferma il remote desktop
    for (const [clientId, adminId] of activeWebRTCSessions.entries()) {
      if (adminId === socket.id) {
        console.log(`[Admin] Admin disconnesso, fermo WebRTC per client: ${clientId}`);
        io.to(clientId).emit('server:webrtc-stop');
        activeWebRTCSessions.delete(clientId);
      }
    }

    // Se era un client sotto controllo, notifica l'admin
    if (activeWebRTCSessions.has(socket.id)) {
      const adminId = activeWebRTCSessions.get(socket.id);
      console.log(`[Client] Client disconnesso durante sessione WebRTC`);
      if (adminId) {
        io.to(adminId).emit('admin:remote-desktop-disconnected', {
          clientId: socket.id,
          message: 'Client disconnected'
        });
      }
      activeWebRTCSessions.delete(socket.id);
    }
  });
});

// Pulizia client non attivi - DISABILITATO (Socket.io gestisce già le disconnessioni)
// setInterval(() => {
//   const now = new Date();
//   const timeout = 60000; // 60 secondi
//
//   connectedClients.forEach((client, clientId) => {
//     const timeSinceLastSeen = now.getTime() - client.lastSeen.getTime();
//
//     if (timeSinceLastSeen > timeout) {
//       console.log(`[Server] Client timeout: ${client.hostname}`);
//       connectedClients.delete(clientId);
//       io.emit('admin:client-disconnected', { clientId });
//     }
//   });
// }, 30000); // Controlla ogni 30 secondi

// Avvio server
httpServer.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Kiosk Server avviato!');
  console.log('='.repeat(50));
  console.log(`📡 Server in ascolto su: http://localhost:${PORT}`);
  console.log(`👤 Admin username: ${ADMIN_USERNAME}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
  console.log('='.repeat(50));
});
