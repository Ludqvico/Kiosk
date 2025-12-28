# Guida alla Configurazione

## Personalizzazione Password

La password di uscita può essere configurata in `src/main.ts`:

```typescript
const EXIT_PASSWORD = 'admin123'; // Modifica qui
```

**Suggerimenti per la password:**
- Usa una password facile da ricordare ma non ovvia
- Non usare parole comuni
- Considera combinazioni di lettere e numeri
- La password è case-sensitive

## Personalizzazione Contenuto

Il contenuto visualizzato si trova in `src/renderer/index.html`.

### Esempio 1: Video locale

```html
<div id="content-container">
  <video autoplay loop muted style="width: 100%; height: 100%;">
    <source src="path/to/video.mp4" type="video/mp4">
  </video>
</div>
```

### Esempio 2: Presentazione Google Slides

```html
<div id="content-container">
  <iframe
    src="https://docs.google.com/presentation/d/e/YOUR_ID/embed?start=true&loop=true&delayms=3000"
    frameborder="0"
    width="100%"
    height="100%"
    allowfullscreen="true">
  </iframe>
</div>
```

### Esempio 3: Applicazione web personalizzata

```html
<div id="content-container">
  <iframe src="http://localhost:3000/lesson" frameborder="0"></iframe>
</div>
```

### Esempio 4: Contenuto HTML statico

```html
<div id="content-container" style="padding: 40px;">
  <h1>Lezione di Storia</h1>
  <p>Contenuto della lezione...</p>
  <img src="image.jpg" alt="Immagine">
</div>
```

## Opzioni Avanzate

### Nascondere il cursore

Il cursore è già nascosto di default. Per mostrarlo, rimuovi questa riga da `src/main.ts`:

```typescript
mainWindow.webContents.insertCSS('* { cursor: none !important; }');
```

### Bloccare anche il movimento del mouse

Nei file nativi (`native/win/input_blocker_win.cc`), decommentare:

```cpp
case WM_MOUSEMOVE:
    return 1; // Blocca anche il movimento
```

### Permettere la digitazione (solo su Windows)

Nel file `native/win/input_blocker_win.cc`, commentare questa riga:

```cpp
// return 1; // Questa riga blocca tutto l'input tastiera
```

Così verranno bloccate solo le combinazioni pericolose ma si potrà digitare normalmente.

## Deployment su più macchine

### Mac
1. Compila il DMG: `npm run package:mac`
2. Distribuisci il file `.dmg` dalla cartella `release/`
3. Su ogni Mac:
   - Installa l'app
   - Vai in Preferenze di Sistema → Sicurezza → Accessibilità
   - Aggiungi l'app SchoolKiosk e abilita

### Windows
1. Compila l'installer: `npm run package:win`
2. Distribuisci il file `.exe` dalla cartella `release/`
3. Su ogni PC Windows:
   - Esegui l'installer come amministratore
   - Crea un collegamento sul desktop
   - Imposta il collegamento per eseguire sempre come amministratore:
     - Tasto destro → Proprietà → Compatibilità
     - Spunta "Esegui come amministratore"

## Avvio automatico all'accesso

### Mac
1. Preferenze di Sistema → Utenti e Gruppi → Elementi login
2. Clicca "+" e aggiungi SchoolKiosk

### Windows
1. Premi Win+R
2. Digita `shell:startup`
3. Copia il collegamento dell'app nella cartella che si apre

## Kiosk dedicato (nessun accesso al sistema)

### Mac (Kiosk Mode permanente)
Usa "Accesso Guidato":
1. Preferenze di Sistema → Accessibilità → Accesso Guidato
2. Abilita e configura
3. Lancia l'app e attiva Accesso Guidato (Cmd+Option+F5)

### Windows (Kiosk Mode permanente)
Usa "Kiosk Mode" di Windows 10/11:
1. Impostazioni → Account → Famiglia e altri utenti
2. Configura Kiosk
3. Seleziona SchoolKiosk come app kiosk

## Gestione remota

Per deployment enterprise, considera:

**Mac:**
- Apple School Manager
- Jamf Pro
- Workspace ONE

**Windows:**
- Microsoft Intune
- Group Policy
- SCCM

## Monitoraggio e Log

I log dell'applicazione sono visibili nella console di Electron. Per accedere:

1. Modifica `src/main.ts` e abilita DevTools temporaneamente:
```typescript
webPreferences: {
  devTools: true // Cambia a true
}
```

2. Premi F12 per aprire la console (prima di attivare il kiosk mode)
