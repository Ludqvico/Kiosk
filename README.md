# School Kiosk System

Sistema kiosk multi-platform (Mac e Windows) per ambienti educativi con **gestione centralizzata**.

Blocca completamente l'input dell'utente (tastiera, mouse, trackpad, gesture) per forzare l'attenzione su un contenuto specifico a schermo intero, controllabile remotamente da una dashboard amministrativa.

## 🎯 Caratteristiche

### Client (Postazione Kiosk)
- ✅ **Multi-platform**: Funziona su Mac e Windows
- ✅ **Blocco completo input**: Blocca tastiera, mouse, trackpad e gesture a livello di sistema
- ✅ **Kiosk mode nativo**: Fullscreen senza bordi o controlli
- ✅ **Blocco combinazioni subdole**:
  - Mac: Cmd+Tab, Cmd+Q, gesture trackpad, Mission Control, ecc.
  - Windows: Ctrl+Alt+Del, Alt+F4, Win+D, Task Manager, ecc.
- ✅ **Exit password**: Sistema di uscita tramite password nascosta
- ✅ **Contenuto personalizzabile**: Facile sostituire il contenuto bianco con lezioni, video, presentazioni
- ✅ **Modalità standalone**: Funziona anche senza connessione al server

### Server + Dashboard (Controllo Centralizzato)
- ✅ **Dashboard web amministrativa**: Interfaccia moderna per gestire tutte le postazioni
- ✅ **Controllo real-time**: Vedi stato di ogni client (online/offline, bloccato/sbloccato)
- ✅ **Comandi remoti**: Blocca/sblocca singole postazioni o tutte insieme
- ✅ **WebSocket (Socket.io)**: Comunicazione real-time bidirezionale
- ✅ **Multi-client**: Gestisci decine di postazioni contemporaneamente
- ✅ **Heartbeat monitoring**: Rileva automaticamente client disconnessi

## 📐 Architettura

```
ADMIN Dashboard (Browser)
         ↕ WebSocket
    SERVER (Node.js)
         ↕ WebSocket
┌────────┬────────┬────────┐
CLIENT  CLIENT  CLIENT  ...
(Mac)   (Win)   (Mac)
```

## 🚀 Quick Start

### Modalità Standalone (Singola postazione, senza server)

```bash
# 1. Clona e installa
git clone <repository-url>
cd Kiosk
npm install
npm run build

# 2. Imposta modalità standalone
echo "STANDALONE_MODE=true" > .env

# 3. Avvia
npm start
```

Il kiosk si bloccherà automaticamente all'avvio. Per uscire, digita: `admin123`

### Modalità Client-Server (Gestione centralizzata)

**Passo 1: Avvia il Server**

```bash
cd server
npm install
npm start
```

Server disponibile su: `http://localhost:3000`

**Passo 2: Configura e avvia i Client**

Su ogni postazione:

```bash
cd Kiosk
npm install
npm run build

# Crea configurazione
cat > .env << EOF
SERVER_URL=http://192.168.1.100:3000
EXIT_PASSWORD=admin123
STANDALONE_MODE=false
EOF

# Avvia
npm start
```

**Passo 3: Apri la Dashboard**

Browser → `http://localhost:3000` (o IP del server)

Username: `admin` / Password: `admin123`

Dalla dashboard puoi:
- Vedere tutti i client connessi
- Bloccare/sbloccare singole postazioni
- Bloccare/sbloccare tutte le postazioni contemporaneamente

## 📋 Requisiti

### Client (Postazioni Kiosk)

**Mac:**
- macOS 10.13+
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 18+
- **Permessi di Accessibilità** (vedi Configurazione)

**Windows:**
- Windows 10/11
- Visual Studio Build Tools 2019+ con Desktop Development with C++
- Node.js 18+
- **Privilegi amministratore** per blocco completo

### Server

- Node.js 18+
- Porte: 3000 (configurabile)

## ⚙️ Configurazione

### Client

Crea file `.env` nella root del progetto client:

```env
# URL del server (usa IP se in rete locale)
SERVER_URL=http://192.168.1.100:3000

# Password di uscita dal kiosk
EXIT_PASSWORD=admin123

# Modalità standalone (true = non si connette al server)
STANDALONE_MODE=false
```

**Mac - Permessi di Accessibilità:**

1. **Preferenze di Sistema** → **Sicurezza e Privacy** → **Privacy** → **Accessibilità**
2. Clicca il lucchetto per sbloccare
3. Aggiungi **Terminal** o **Electron** alla lista
4. Seleziona la checkbox

**Windows - Esecuzione come Amministratore:**

- Tasto destro sull'app → **Esegui come amministratore**

### Server

Modifica `server/.env`:

```env
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your-secret-key-change-in-production
```

## 🎛️ Utilizzo Dashboard

### Accedi alla Dashboard

Browser → `http://server-ip:3000`

### Comandi Disponibili

- **Blocca Tutti**: Blocca tutte le postazioni contemporaneamente
- **Sblocca Tutti**: Sblocca tutte le postazioni
- **Blocca** (su singola card): Blocca solo quella postazione
- **Sblocca** (su singola card): Sblocca solo quella postazione

### Monitoraggio

La dashboard mostra in real-time:
- 🟢 Client connessi (numero totale)
- 🔒 Client bloccati
- Hostname di ogni client
- Piattaforma (Mac/Windows)
- Stato (Bloccato/Sbloccato)
- Tempo di connessione

## 📡 Deployment in Rete Locale (Scuola)

### Scenario: Controllo aula computer

**Server** (PC insegnante):
```bash
cd server
npm install
npm start
# Annota l'IP: ifconfig / ipconfig
```

**Client** (ogni PC studente):
```bash
cd Kiosk
npm install
npm run build

# Configurazione
cat > .env << EOF
SERVER_URL=http://192.168.1.100:3000  # IP insegnante
EXIT_PASSWORD=segreto123
STANDALONE_MODE=false
EOF

npm start
```

**Dashboard** (browser insegnante):
`http://localhost:3000`

Ora l'insegnante può bloccare/sbloccare tutte le postazioni con un click!

## 🔧 Personalizzare il Contenuto

Il contenuto visualizzato si trova in `src/renderer/index.html`.

**Esempio - Video:**
```html
<div id="content-container">
  <video autoplay loop muted style="width: 100%; height: 100%;">
    <source src="lezione.mp4" type="video/mp4">
  </video>
</div>
```

**Esempio - Sito web:**
```html
<div id="content-container">
  <iframe src="https://lezione.scuola.it" frameborder="0"></iframe>
</div>
```

Vedi `CONFIGURATION.md` per altri esempi.

## 📦 Build per Distribuzione

### Client

```bash
npm run package:mac   # Crea DMG per Mac
npm run package:win   # Crea installer EXE per Windows
```

Gli installer saranno in `release/`.

### Server

Il server non richiede build, è già pronto:

```bash
cd server
npm install --production
npm start
```

Per deployment su server dedicato, considera PM2:

```bash
npm install -g pm2
pm2 start dist/server.js --name kiosk-server
pm2 save
pm2 startup
```

## 📚 Documentazione

- **README.md** (questo file): Panoramica generale
- **CLIENT-SERVER.md**: Documentazione completa architettura client-server, eventi, troubleshooting
- **CONFIGURATION.md**: Guida personalizzazione contenuto, password, deployment

## 🔒 Sicurezza

### Produzione

Prima di usare in produzione:

1. Cambia password admin in `server/.env`
2. Cambia `JWT_SECRET` in `server/.env`
3. Cambia `EXIT_PASSWORD` nel `.env` del client
4. Usa HTTPS (reverse proxy nginx/apache)
5. Limita accesso server solo da rete locale
6. Considera VLAN dedicata per le postazioni

### Limitazioni Note

**Mac:**
- Cmd+Option+Esc (Force Quit) potrebbe essere ancora accessibile con privilegi admin
- System Integrity Protection (SIP) limita alcune funzionalità

**Windows:**
- Ctrl+Alt+Del è gestito dal kernel Windows e non può essere bloccato completamente

**Raccomandazioni:**
- Usa account utente con privilegi limitati sulle postazioni
- Configura Group Policy (Windows) o MDM (Mac) per restrizioni aggiuntive

## 🛠️ Troubleshooting

### Client non si connette al server

```bash
# Verifica che il server sia raggiungibile
ping 192.168.1.100

# Testa la porta
telnet 192.168.1.100 3000
```

Controlla firewall su Mac/Windows.

### Errore "Impossibile caricare addon nativo"

```bash
npm run rebuild
```

### Mac: Input non viene bloccato

Controlla i permessi di Accessibilità (vedi Configurazione).

### Windows: Input non viene bloccato completamente

Esegui come amministratore.

### Altri problemi

Consulta `CLIENT-SERVER.md` per troubleshooting dettagliato.

## 📊 Scalabilità

Il sistema supporta:
- ✅ **50+ client contemporanei** (testato)
- ✅ Reconnection automatica
- ✅ Heartbeat ogni 30s
- ✅ Timeout client inattivi (60s)

Per deployment più grandi, considera:
- Server dedicato con più risorse
- Redis per session storage
- Load balancing

## 🗺️ Roadmap

- [ ] Autenticazione JWT reale
- [ ] Gruppi di client (per aule multiple)
- [ ] Schedulazione automatica (blocco/sblocco programmato)
- [ ] Screenshot remoti
- [ ] Broadcast messaggi
- [ ] Statistiche utilizzo
- [ ] Mobile app admin

## 🆘 Supporto

Per problemi:

1. Controlla i log (Terminale del client e server)
2. Consulta `CLIENT-SERVER.md` per troubleshooting
3. Verifica requisiti e permessi
4. Apri una issue su GitHub

## 📄 Licenza

MIT

---

**Sviluppato per ambienti educativi** - Aiuta insegnanti e studenti a rimanere concentrati! 🎓
