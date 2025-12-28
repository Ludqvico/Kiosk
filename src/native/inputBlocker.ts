import * as path from 'path';

// Importa l'addon nativo
let nativeAddon: any = null;
try {
  nativeAddon = require('../../build/Release/inputblocker.node');
} catch (error) {
  console.error('Impossibile caricare l\'addon nativo:', error);
  console.error('Esegui "npm run rebuild" per compilare gli addon nativi');
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
      console.error('Addon nativo non disponibile');
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

    if (!nativeAddon) {
      console.error('Addon nativo non disponibile');
      return;
    }

    try {
      const result = nativeAddon.blockInput();
      this.isBlocking = result;

      if (result) {
        console.log('✓ Blocco input Windows attivato');
        console.log('IMPORTANTE: L\'app deve essere eseguita come amministratore per il blocco completo');
      } else {
        console.error('✗ Impossibile bloccare l\'input');
      }
    } catch (error) {
      console.error('Errore nel blocco input Windows:', error);
    }
  }

  unblock() {
    if (!this.isBlocking) {
      return;
    }

    if (!nativeAddon) {
      console.error('Addon nativo non disponibile');
      return;
    }

    console.log('Sblocco input...');

    try {
      const result = nativeAddon.unblockInput();
      if (result) {
        this.isBlocking = false;
        console.log('✓ Input sbloccato');
      } else {
        console.error('✗ Errore nello sblocco input');
      }
    } catch (error) {
      console.error('Errore nello sblocco input:', error);
    }
  }

  isInputBlocked(): boolean {
    return this.isBlocking;
  }
}
