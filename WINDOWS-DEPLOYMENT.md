# ISTRUZIONI DEPLOYMENT WINDOWS

## IMPORTANTE: Requisiti per blocco completo

### 1. Windows 10/11 (NON Windows 7)
Windows 7 non è supportato per gli addon nativi. Serve **Windows 10 o superiore**.

### 2. Esecuzione come Amministratore
Il client DEVE essere eseguito come amministratore per:
- Bloccare Task Manager
- Intercettare input a livello kernel
- Disabilitare tasti Windows

### 3. Compilare gli addon nativi

```powershell
# PowerShell come Amministratore
cd C:\Kiosk

# Installa build tools se non presenti
npm install --global windows-build-tools

# Ricompila addon nativi
npm run rebuild

# Verifica che siano compilati
dir build\Release\inputblocker.node
```

## Avvio in produzione (SENZA console)

### Opzione A: Script PowerShell (consigliato)

```powershell
# PowerShell come Amministratore
cd C:\Kiosk
.\start-client.ps1
```

### Opzione B: Script VBS

```cmd
# Doppio click su:
C:\Kiosk\start-hidden.vbs
```

### Opzione C: Task Scheduler

1. Apri Task Scheduler
2. Crea nuova attività
3. Trigger: All'avvio del sistema
4. Azione: Avvia programma
   - Programma: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
   - Argomenti: `-ExecutionPolicy Bypass -File "C:\Kiosk\start-client.ps1"`
5. Imposta: Esegui con privilegi più elevati

## Test console visibile (per debug)

```powershell
cd C:\Kiosk
npm start
```

## Verificare che gli addon funzionino

Console dovrebbe mostrare:
```
✓ Blocco input Windows attivato
```

Se vedi:
```
✗ Impossibile bloccare l'input
```

Allora gli addon NON sono compilati. Ri-esegui `npm run rebuild`.

## Killare il processo (in caso di problemi)

```powershell
# Se il client è bloccato e non risponde:
Get-Process electron | Stop-Process -Force
```

## Note di sicurezza

- Il client blocca Task Manager via registro (HKEY_CURRENT_USER)
- Al primo avvio, Windows potrebbe chiedere permessi firewall
- Se il PC va in sleep, il blocco potrebbe non riprendere correttamente
- Disabilitare sleep/ibernazione per deployment produzione

## Problemi comuni

### "Addon nativo non trovato"
→ `npm run rebuild` come amministratore

### "Alt+F4 funziona ancora"
→ Gli addon non sono attivi, verifica privilegi amministratore

### "Console visibile"
→ Usa `start-client.ps1` invece di `npm start`

### "Ctrl+C killa il processo"
→ Console non dovrebbe essere visibile, usa script nascosti
