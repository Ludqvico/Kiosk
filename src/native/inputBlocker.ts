import * as path from 'path';
import { execSync } from 'child_process';

// Prova a caricare addon nativo (per Mac)
let nativeAddon: any = null;
try {
  nativeAddon = require('../../build/Release/inputblocker.node');
} catch (error) {
  // Addon non disponibile - useremo PowerShell su Windows
}

export class InputBlocker {
  private isBlocking = false;
  private platform: string;

  constructor() {
    this.platform = process.platform;
  }

  blockMacInput() {
    if (this.platform !== 'darwin') {
      console.warn('blockMacInput chiamato su piattaforma non-Mac');
      return;
    }

    if (!nativeAddon) {
      console.error('Addon nativo non disponibile per Mac');
      return;
    }

    try {
      const result = nativeAddon.blockInput();
      this.isBlocking = result;

      if (result) {
        console.log('✓ Blocco input Mac attivato');
        console.log('IMPORTANTE: Assicurati che l\'app abbia i permessi di Accessibilità');
        console.log('  Vai in: Preferenze di Sistema > Sicurezza e Privacy > Privacy > Accessibilità');
      } else {
        console.error('✗ Impossibile bloccare l\'input');
      }
    } catch (error) {
      console.error('Errore nel blocco input Mac:', error);
    }
  }

  blockWindowsInput() {
    if (this.platform !== 'win32') {
      console.warn('blockWindowsInput chiamato su piattaforma non-Windows');
      return;
    }

    try {
      // USA POWERSHELL DIRETTO - NO COMPILAZIONE RICHIESTA
      const scriptPath = path.join(__dirname, '..', 'native', 'win', 'BlockInput.ps1');
      console.log('[Windows] Blocco input via PowerShell:', scriptPath);

      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" block`,
        { encoding: 'utf8' }
      ).trim();

      if (result === 'BLOCKED') {
        this.isBlocking = true;
        console.log('✓ Blocco input Windows attivato (PowerShell)');
        console.log('✓ Explorer.exe killato - Alt+Tab disabilitato');
        console.log('✓ BlockInput() attivo - mouse e tastiera bloccati');
      } else {
        console.error('✗ BlockInput fallito - DEVI eseguire come AMMINISTRATORE');
      }
    } catch (error) {
      console.error('Errore nel blocco input Windows:', error);
    }
  }

  unblock() {
    if (!this.isBlocking) {
      return;
    }

    console.log('Sblocco input...');

    try {
      if (this.platform === 'darwin' && nativeAddon) {
        const result = nativeAddon.unblockInput();
        if (result) {
          this.isBlocking = false;
          console.log('✓ Input sbloccato (Mac)');
        }
      } else if (this.platform === 'win32') {
        const scriptPath = path.join(__dirname, '..', 'native', 'win', 'BlockInput.ps1');
        const result = execSync(
          `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" unblock`,
          { encoding: 'utf8' }
        ).trim();

        if (result === 'UNBLOCKED') {
          this.isBlocking = false;
          console.log('✓ Input sbloccato (Windows)');
          console.log('✓ Explorer.exe riavviato');
        }
      }
    } catch (error) {
      console.error('Errore nello sblocco input:', error);
    }
  }

  isInputBlocked(): boolean {
    return this.isBlocking;
  }
}
