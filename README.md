# School Kiosk System

Sistema kiosk multi-platform (Mac e Windows) per ambienti educativi. Blocca completamente l'input dell'utente (tastiera, mouse, trackpad, gesture) per forzare l'attenzione su un contenuto specifico a schermo intero.

## Caratteristiche

- ✅ **Multi-platform**: Funziona su Mac e Windows
- ✅ **Blocco completo input**: Blocca tastiera, mouse, trackpad e gesture
- ✅ **Kiosk mode nativo**: Fullscreen senza bordi o controlli
- ✅ **Blocco combinazioni subdole**:
  - Mac: Cmd+Tab, Cmd+Q, gesture trackpad, Mission Control, ecc.
  - Windows: Ctrl+Alt+Del, Alt+F4, Win+D, Task Manager, ecc.
- ✅ **Exit password**: Sistema di uscita tramite password nascosta
- ✅ **Contenuto personalizzabile**: Facile sostituire il contenuto bianco con lezioni, video, presentazioni

## Requisiti

### Mac
- macOS 10.13 o superiore
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 18+ e npm
- **Permessi di Accessibilità** (vedi sezione Configurazione)

### Windows
- Windows 10/11
- Visual Studio Build Tools 2019+ con Desktop Development with C++
- Node.js 18+ e npm
- **Privilegi amministratore** per il blocco completo

## Installazione

```bash
# 1. Clona il repository
git clone <repository-url>
cd Kiosk

# 2. Installa le dipendenze e compila gli addon nativi
npm install

# 3. Compila TypeScript
npm run build
```

## Configurazione

### Mac - Permessi di Accessibilità

Per bloccare completamente l'input su Mac, l'app deve avere i permessi di Accessibilità:

1. Vai in **Preferenze di Sistema** → **Sicurezza e Privacy** → **Privacy** → **Accessibilità**
2. Clicca sul lucchetto per sbloccare
3. Aggiungi l'app Electron alla lista (o Terminal se esegui da sviluppo)
4. Seleziona la checkbox per abilitare

### Windows - Esecuzione come Amministratore

Per bloccare completamente l'input su Windows:

1. Clicca destro sull'eseguibile
2. Seleziona **Esegui come amministratore**

Oppure, durante lo sviluppo, esegui il terminale come amministratore prima di lanciare `npm start`.

## Utilizzo

### Modalità sviluppo

```bash
npm run dev
```

### Modalità produzione

```bash
npm start
```

### Uscire dalla modalità kiosk

Digita la password di uscita (default: `admin123`). La password viene digitata "alla cieca" senza feedback visivo.

**Per modificare la password**, apri `src/main.ts` e cambia la variabile `EXIT_PASSWORD`:

```typescript
const EXIT_PASSWORD = 'tuaPasswordQui';
```

## Personalizzare il contenuto

Il contenuto visualizzato si trova in `src/renderer/index.html`. Puoi modificare il file per:

- Mostrare una presentazione
- Incorporare un video
- Caricare un sito web tramite iframe
- Visualizzare materiale didattico personalizzato

Esempio - Sostituire con un video:

```html
<div id="content-container">
  <video autoplay loop>
    <source src="lezione.mp4" type="video/mp4">
  </video>
</div>
```

Esempio - Caricare un sito web:

```html
<div id="content-container">
  <iframe src="https://tuosito.com/lezione" frameborder="0"></iframe>
</div>
```

## Build per distribuzione

### Mac (DMG)

```bash
npm run package:mac
```

L'installer DMG verrà creato in `release/`.

### Windows (EXE)

```bash
npm run package:win
```

L'installer NSIS verrà creato in `release/`.

## Architettura tecnica

Il sistema si basa su:

- **Electron**: Framework per app desktop multi-platform
- **TypeScript**: Linguaggio type-safe per lo sviluppo
- **Addon nativi Node.js**: Moduli C++/Objective-C++ per bloccare l'input a livello di sistema operativo
  - Mac: Usa `CGEventTap` API per intercettare eventi
  - Windows: Usa `SetWindowsHookEx` API per intercettare eventi

### File principali

- `src/main.ts`: Processo principale Electron, gestisce la finestra e il kiosk mode
- `src/native/inputBlocker.ts`: Wrapper TypeScript per gli addon nativi
- `native/mac/input_blocker_mac.mm`: Addon nativo Mac (Objective-C++)
- `native/win/input_blocker_win.cc`: Addon nativo Windows (C++)
- `src/renderer/index.html`: UI/Contenuto visualizzato

## Sicurezza e limitazioni

### Mac
- Richiede permessi di Accessibilità (l'utente deve autorizzare)
- Non può bloccare Cmd+Option+Esc (Force Quit) se l'utente ha privilegi amministratore
- System Integrity Protection (SIP) potrebbe limitare alcune funzionalità

### Windows
- Richiede privilegi amministratore per blocco completo
- Ctrl+Alt+Del è gestito dal kernel e non può essere bloccato completamente (security feature Windows)

### Raccomandazioni
- Usa account utente con privilegi limitati
- Configura Group Policy su Windows per ulteriori restrizioni
- Su Mac, considera MDM (Mobile Device Management) per deployment enterprise

## Troubleshooting

### "Impossibile caricare l'addon nativo"

Esegui:
```bash
npm run rebuild
```

### Su Mac, l'input non viene bloccato

Controlla i permessi di Accessibilità (vedi sezione Configurazione).

### Su Windows, l'input non viene bloccato completamente

Assicurati di eseguire l'app come amministratore.

### La password di uscita non funziona

- Verifica di digitare esattamente la password configurata in `EXIT_PASSWORD`
- La password è case-sensitive
- Non c'è feedback visivo durante la digitazione

## Licenza

MIT

## Supporto

Per bug o richieste di feature, apri una issue su GitHub.
