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

const connectedClients = new Map<string, KioskClient>();

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
    }
  });

  socket.on('admin:unlock-client', (clientId: string) => {
    console.log(`[Admin] Richiesta unlock per client: ${clientId}`);

    const client = connectedClients.get(clientId);
    if (client) {
      io.to(clientId).emit('server:unlock');
      console.log(`[Server] Comando UNLOCK inviato a ${client.hostname}`);
    }
  });

  socket.on('admin:lock-all', () => {
    console.log('[Admin] Richiesta LOCK per tutti i client');
    io.emit('server:lock');
  });

  socket.on('admin:unlock-all', () => {
    console.log('[Admin] Richiesta UNLOCK per tutti i client');
    io.emit('server:unlock');
  });

  // Disconnessione
  socket.on('disconnect', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      console.log(`[Client] Disconnesso: ${client.hostname}`);
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
