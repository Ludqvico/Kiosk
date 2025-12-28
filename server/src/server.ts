import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
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
  });
});

// Pulizia client non attivi (opzionale)
setInterval(() => {
  const now = new Date();
  const timeout = 60000; // 60 secondi

  connectedClients.forEach((client, clientId) => {
    const timeSinceLastSeen = now.getTime() - client.lastSeen.getTime();

    if (timeSinceLastSeen > timeout) {
      console.log(`[Server] Client timeout: ${client.hostname}`);
      connectedClients.delete(clientId);
      io.emit('admin:client-disconnected', { clientId });
    }
  });
}, 30000); // Controlla ogni 30 secondi

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
