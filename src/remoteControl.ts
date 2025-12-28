import { desktopCapturer, screen } from 'electron';

// robotjs import with fallback
let robot: any = null;
try {
  robot = require('robotjs');
} catch (error) {
  console.warn('[RemoteControl] robotjs not available - input simulation disabled');
}

export class RemoteControl {
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private onFrameCallback: ((frame: string, width: number, height: number) => void) | null = null;
  private screenWidth = 0;
  private screenHeight = 0;

  constructor() {
    // Ottieni dimensioni schermo
    const primaryDisplay = screen.getPrimaryDisplay();
    this.screenWidth = primaryDisplay.size.width;
    this.screenHeight = primaryDisplay.size.height;
  }

  // Avvia cattura schermo
  async startCapture(fps: number = 10) {
    if (this.isCapturing) {
      console.log('[RemoteControl] Screen capture già attivo');
      return;
    }

    this.isCapturing = true;
    console.log(`[RemoteControl] Avvio screen capture a ${fps} FPS`);

    // Cattura frame ogni 1000/fps millisecondi
    const intervalMs = 1000 / fps;

    this.captureInterval = setInterval(async () => {
      await this.captureFrame();
    }, intervalMs);
  }

  // Ferma cattura schermo
  stopCapture() {
    if (!this.isCapturing) {
      return;
    }

    this.isCapturing = false;
    console.log('[RemoteControl] Stop screen capture');

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  // Cattura singolo frame
  private async captureFrame() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: 1280,
          height: 720
        }
      });

      if (sources.length === 0) {
        console.error('[RemoteControl] Nessuna sorgente schermo trovata');
        return;
      }

      // Prendi il primo schermo
      const source = sources[0];
      const thumbnail = source.thumbnail;

      // Converti in base64 (formato PNG)
      const dataUrl = thumbnail.toDataURL();

      if (this.onFrameCallback) {
        this.onFrameCallback(dataUrl, thumbnail.getSize().width, thumbnail.getSize().height);
      }
    } catch (error) {
      console.error('[RemoteControl] Errore cattura frame:', error);
    }
  }

  // Registra callback per frame catturati
  onFrame(callback: (frame: string, width: number, height: number) => void) {
    this.onFrameCallback = callback;
  }

  // ========== INPUT SIMULATION ==========

  // Processa input remoto
  processRemoteInput(type: string, data: any) {
    if (!robot) {
      console.warn('[RemoteControl] Cannot process input - robotjs not available');
      return;
    }

    try {
      switch (type) {
        case 'mousemove':
          this.handleMouseMove(data);
          break;

        case 'mousedown':
          this.handleMouseDown(data);
          break;

        case 'mouseup':
          this.handleMouseUp(data);
          break;

        case 'click':
          this.handleClick(data);
          break;

        case 'keydown':
          this.handleKeyDown(data);
          break;

        case 'keyup':
          this.handleKeyUp(data);
          break;

        case 'keypress':
          this.handleKeyPress(data);
          break;

        default:
          console.warn(`[RemoteControl] Tipo input non riconosciuto: ${type}`);
      }
    } catch (error) {
      console.error(`[RemoteControl] Errore processing input ${type}:`, error);
    }
  }

  // Mouse move
  private handleMouseMove(data: { x: number; y: number }) {
    // Converti coordinate normalizzate (0-1) in coordinate assolute
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    robot.moveMouse(x, y);
  }

  // Mouse down
  private handleMouseDown(data: { x: number; y: number; button: string }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    robot.moveMouse(x, y);
    robot.mouseToggle('down', data.button === 'right' ? 'right' : 'left');
  }

  // Mouse up
  private handleMouseUp(data: { x: number; y: number; button: string }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    robot.moveMouse(x, y);
    robot.mouseToggle('up', data.button === 'right' ? 'right' : 'left');
  }

  // Click
  private handleClick(data: { x: number; y: number; button: string }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    robot.moveMouse(x, y);
    robot.mouseClick(data.button === 'right' ? 'right' : 'left');
  }

  // Key down
  private handleKeyDown(data: { key: string; modifiers: string[] }) {
    const key = this.mapKey(data.key);

    if (data.modifiers && data.modifiers.length > 0) {
      // Con modificatori
      const modifiers = data.modifiers.map(m => this.mapKey(m));
      robot.keyToggle(key, 'down', modifiers);
    } else {
      robot.keyToggle(key, 'down');
    }
  }

  // Key up
  private handleKeyUp(data: { key: string; modifiers: string[] }) {
    const key = this.mapKey(data.key);

    if (data.modifiers && data.modifiers.length > 0) {
      const modifiers = data.modifiers.map(m => this.mapKey(m));
      robot.keyToggle(key, 'up', modifiers);
    } else {
      robot.keyToggle(key, 'up');
    }
  }

  // Key press (tipo su stringa)
  private handleKeyPress(data: { text: string }) {
    robot.typeString(data.text);
  }

  // Mappa tasti web a robotjs
  private mapKey(key: string): string {
    const keyMap: { [key: string]: string } = {
      'Control': 'control',
      'Alt': 'alt',
      'Shift': 'shift',
      'Meta': 'command',
      'Enter': 'enter',
      'Backspace': 'backspace',
      'Tab': 'tab',
      'Escape': 'escape',
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Delete': 'delete',
      'Home': 'home',
      'End': 'end',
      'PageUp': 'pageup',
      'PageDown': 'pagedown',
      ' ': 'space'
    };

    return keyMap[key] || key.toLowerCase();
  }

  // Verifica se in cattura
  isActive(): boolean {
    return this.isCapturing;
  }
}
