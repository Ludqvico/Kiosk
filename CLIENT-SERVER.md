# Sistema Client-Server Kiosk

Documentazione completa del sistema di gestione centralizzata delle postazioni kiosk.

## 📐 Architettura

```
┌─────────────────────────────────────────┐
│   ADMIN (Browser)                       │
│   Dashboard http://server:3000          │
└────────────┬────────────────────────────┘
             │ WebSocket
             │ (Socket.io)
┌────────────▼────────────────────────────┐
│   SERVER (Node.js)                      │
│   - Express                             │
│   - Socket.io                           │
│   - Gestione client connessi            │
│   - Invio comandi lock/unlock           │
└────────────┬────────────────────────────┘
             │ WebSocket
             │ (Socket.io)
    ┌────────┴────────┬──────────┬───────┐
    │                 │          │       │
┌───▼────┐     ┌─────▼───┐  ┌──▼────┐  ...
│ CLIENT │     │ CLIENT  │  │ CLIENT│
│ Mac    │     │ Windows │  │ Mac   │
│ (Kiosk)│     │ (Kiosk) │  │(Kiosk)│
└────────┘     └─────────┘  └───────┘
```

## 🚀 Quick Start

### 1. Avvia il Server

```bash
cd server
npm install
npm start
```

Il server partirà su `http://localhost:3000`

### 2. Avvia i Client

Su ogni postazione kiosk:

```bash
cd Kiosk
npm install
npm run build
npm start
```

Il client si connetterà automaticamente al server su `localhost:3000`.

### 3. Apri la Dashboard Admin

Apri il browser e vai su: **http://localhost:3000**

Username: `admin`
Password: `admin123`

## 📡 Comunicazione Client-Server

### Eventi Server → Client

- `server:lock` - Blocca il kiosk
- `server:unlock` - Sblocca il kiosk

### Eventi Client → Server

- `client:register` - Registra il client al server (invia hostname e platform)
- `client:heartbeat` - Heartbeat ogni 30s per mantenere viva la connessione
- `client:status` - Notifica cambiamento di stato (locked/unlocked)

### Eventi Dashboard ↔ Server

- `admin:lock-client` - Blocca un client specifico
- `admin:unlock-client` - Sblocca un client specifico
- `admin:lock-all` - Blocca tutti i client
- `admin:unlock-all` - Sblocca tutti i client
- `admin:client-connected` - Notifica nuovo client connesso
- `admin:client-disconnected` - Notifica client disconnesso
- `admin:client-status` - Notifica cambio stato client

## ⚙️ Configurazione

### Server

Modifica `server/.env`:

```env
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your-secret-key
```

### Client

Crea un file `.env` nella root del progetto client:

```env
SERVER_URL=http://192.168.1.100:3000  # IP del server
EXIT_PASSWORD=admin123
STANDALONE_MODE=false
```

**Variabili d'ambiente:**

- `SERVER_URL`: URL del server (default: `http://localhost:3000`)
- `EXIT_PASSWORD`: Password per uscire dal kiosk (default: `admin123`)
- `STANDALONE_MODE`: Se `true`, il client non si connette al server e blocca automaticamente all'avvio

## 🏢 Deployment in Rete Locale

### Scenario: Scuola con più aule

1. **Server centrale** (PC dell'insegnante o server dedicato):
   ```bash
   cd server
   npm install
   npm start
   ```

   Il server partirà su tutte le interfacce di rete.

2. **Trova l'IP del server**:
   - Mac: `ifconfig | grep "inet "`
   - Windows: `ipconfig`
   - Linux: `ip addr`

   Esempio: `192.168.1.100`

3. **Configura i client** (su ogni postazione studente):

   Crea il file `.env`:
   ```env
   SERVER_URL=http://192.168.1.100:3000
   EXIT_PASSWORD=tuapassword
   STANDALONE_MODE=false
   ```

4. **Avvia i client**:
   ```bash
   npm start
   ```

5. **Dashboard admin** (dal PC insegnante):

   Apri browser: `http://192.168.1.100:3000`

## 🔒 Modalità di Funzionamento

### Modalità Client-Server (default)

- Il client si connette al server all'avvio
- L'admin controlla quando bloccare/sbloccare da dashboard
- Il client invia heartbeat ogni 30s
- Se perde la connessione, rimane nello stato attuale

### Modalità Standalone

Imposta `STANDALONE_MODE=true` nel `.env` del client:

- Il client **non si connette** al server
- Blocca **automaticamente** all'avvio
- Funziona anche senza rete
- Utile per postazioni isolate o test

## 🎛️ Comandi Dashboard

### Blocca singola postazione
Clicca "Blocca" sulla card del client

### Sblocca singola postazione
Clicca "Sblocca" sulla card del client

### Blocca tutte le postazioni
Clicca "🔒 Blocca Tutti"

### Sblocca tutte le postazioni
Clicca "🔓 Sblocca Tutti"

### Stato real-time
- Verde "🔓 Sbloccato" = postazione libera
- Rosso "🔒 Bloccato" = postazione bloccata

## 🔧 Troubleshooting

### Client non si connette al server

1. Verifica che il server sia avviato:
   ```bash
   cd server && npm start
   ```

2. Verifica l'IP nel file `.env` del client

3. Controlla il firewall:
   - Mac: Preferenze → Sicurezza → Firewall → Opzioni
   - Windows: Pannello di controllo → Windows Defender Firewall

4. Testa la connessione:
   ```bash
   ping 192.168.1.100  # IP del server
   ```

### Dashboard non carica

1. Verifica che il server sia in ascolto:
   ```bash
   lsof -i :3000  # Mac/Linux
   netstat -an | findstr :3000  # Windows
   ```

2. Prova ad accedere da localhost prima:
   `http://localhost:3000`

3. Controlla i log del server per errori

### Client appare offline ma è connesso

- Potrebbe esserci un problema di heartbeat
- Riavvia il client
- Controlla i log nel Terminale del client

## 📊 Monitoraggio

### Log Server

I log del server mostrano:
- Nuove connessioni client
- Comandi inviati
- Client disconnessi

```bash
cd server
npm start

# Output:
[Socket.io] Nuova connessione: abc123
[Client] Registrato: MacBook-Pro.local (darwin)
[Admin] Richiesta lock per client: abc123
[Server] Comando LOCK inviato a MacBook-Pro.local
```

### Log Client

I log del client (visibili nel Terminale) mostrano:
- Connessione al server
- Comandi ricevuti
- Stato blocco/sblocco

```bash
npm start

# Output:
[ServerConnection] Connessione a http://localhost:3000...
[ServerConnection] ✓ Connesso al server
[Main] Ricevuto comando LOCK dal server
[Main] 🔒 BLOCCO KIOSK
```

## 🔐 Sicurezza

### Produzione

Per deployment in produzione, modifica:

1. **Password admin** in `server/.env`
2. **JWT_SECRET** in `server/.env` (usa stringa casuale lunga)
3. **EXIT_PASSWORD** in `.env` del client
4. Abilita HTTPS (usa reverse proxy come nginx)
5. Implementa autenticazione JWT reale (ora è semplificata)

### Rete

- Usa una VLAN dedicata per le postazioni kiosk
- Limita l'accesso al server solo dalla rete locale
- Considera un firewall per bloccare accessi esterni

## 📈 Scalabilità

Il sistema supporta:
- ✅ Decine di client contemporanei (testato fino a 50)
- ✅ Reconnection automatica se perde connessione
- ✅ Heartbeat per rilevare client disconnessi
- ✅ Timeout automatico client inattivi (60s)

Per deployment più grandi (100+ client):
- Usa un server dedicato potente
- Considera Redis per session storage
- Implementa load balancing con nginx

## 🛠️ Sviluppo

### Modificare la Dashboard

La dashboard si trova in `server/public/dashboard.html` ed è un singolo file HTML+CSS+JS.

Per personalizzarla:
- Modifica gli stili CSS
- Aggiungi nuove funzionalità JavaScript
- Estendi gli eventi Socket.io

### Aggiungere nuovi comandi

1. **Server** (`server/src/server.ts`):
   ```typescript
   socket.on('admin:custom-command', (data) => {
     io.to(clientId).emit('server:custom-command', data);
   });
   ```

2. **Client** (`src/serverConnection.ts`):
   ```typescript
   this.socket.on('server:custom-command', (data) => {
     // Gestisci comando
   });
   ```

3. **Dashboard** (`server/public/dashboard.html`):
   ```javascript
   function sendCustomCommand(clientId) {
     socket.emit('admin:custom-command', { clientId, data });
   }
   ```

## 📝 TODO / Roadmap

- [ ] Autenticazione JWT reale per admin
- [ ] Persistenza configurazioni client (database)
- [ ] Logs persistenti delle attività
- [ ] Gruppi di client (es: "Aula 1", "Aula 2")
- [ ] Schedulazione automatica (blocca/sblocca in orari prestabiliti)
- [ ] Screenshot remoti delle postazioni
- [ ] Broadcast messaggi ai client
- [ ] Statistiche utilizzo (tempo bloccato/sbloccato)
- [ ] Mobile app per controllo admin

## 🆘 Supporto

Per problemi o domande, controlla i log sia del server che del client e cerca errori specifici.

Errori comuni:
- `ECONNREFUSED`: Server non raggiungibile
- `ETIMEDOUT`: Timeout connessione (firewall?)
- `Impossibile caricare addon nativo`: Riesegui `npm install`
