import { desktopCapturer, screen } from 'electron';
import * as path from 'path';
import { execSync } from 'child_process';

// robotjs import with fallback (solo per Mac/Linux)
let robot: any = null;
const platform = process.platform;

if (platform === 'darwin' || platform === 'linux') {
  try {
    robot = require('robotjs');
    console.log('[RemoteControl] robotjs caricato per', platform);
  } catch (error) {
    console.warn('[RemoteControl] robotjs not available');
  }
}

export class RemoteControl {
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private onFrameCallback: ((frame: string, width: number, height: number) => void) | null = null;
  private screenWidth = 0;
  private screenHeight = 0;
  private platform = process.platform;

  constructor() {
    // Ottieni dimensioni schermo
    const primaryDisplay = screen.getPrimaryDisplay();
    this.screenWidth = primaryDisplay.size.width;
    this.screenHeight = primaryDisplay.size.height;

    console.log(`[RemoteControl] Inizializzato per ${this.platform} - Screen: ${this.screenWidth}x${this.screenHeight}`);
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

  // ========== WINDOWS POWERSHELL INPUT ==========

  private execPowerShellInput(command: string, ...args: any[]): boolean {
    try {
      const scriptPath = path.join(__dirname, '..', 'native', 'win', 'SimulateInput.ps1');
      const psArgs = args.map(a => `"${a}"`).join(' ');
      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" ${command} ${psArgs}`,
        { encoding: 'utf8', timeout: 1000 }
      ).trim();
      return result === 'OK';
    } catch (error) {
      console.error('[RemoteControl] PowerShell input error:', error);
      return false;
    }
  }

  // ========== MOUSE HANDLERS ==========

  private handleMouseMove(data: { x: number; y: number }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    if (this.platform === 'win32') {
      this.execPowerShellInput('mousemove', x, y);
    } else if (robot) {
      robot.moveMouse(x, y);
    }
  }

  private handleMouseDown(data: { x: number; y: number; button: string }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    if (this.platform === 'win32') {
      this.execPowerShellInput('mousemove', x, y);
      this.execPowerShellInput('mousedown', data.button === 'right' ? 'right' : 'left');
    } else if (robot) {
      robot.moveMouse(x, y);
      robot.mouseToggle('down', data.button === 'right' ? 'right' : 'left');
    }
  }

  private handleMouseUp(data: { x: number; y: number; button: string }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    if (this.platform === 'win32') {
      this.execPowerShellInput('mousemove', x, y);
      this.execPowerShellInput('mouseup', data.button === 'right' ? 'right' : 'left');
    } else if (robot) {
      robot.moveMouse(x, y);
      robot.mouseToggle('up', data.button === 'right' ? 'right' : 'left');
    }
  }

  private handleClick(data: { x: number; y: number; button: string }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    if (this.platform === 'win32') {
      this.execPowerShellInput('click', x, y, data.button === 'right' ? 'right' : 'left');
    } else if (robot) {
      robot.moveMouse(x, y);
      robot.mouseClick(data.button === 'right' ? 'right' : 'left');
    }
  }

  // ========== KEYBOARD HANDLERS ==========

  private handleKeyDown(data: { key: string; modifiers: string[] }) {
    if (this.platform === 'win32') {
      const vkCode = this.keyToVirtualKeyCode(data.key);
      if (vkCode !== null) {
        this.execPowerShellInput('keydown', vkCode);
      }
    } else if (robot) {
      const key = this.mapKeyForRobot(data.key);
      if (data.modifiers && data.modifiers.length > 0) {
        const modifiers = data.modifiers.map(m => this.mapKeyForRobot(m));
        robot.keyToggle(key, 'down', modifiers);
      } else {
        robot.keyToggle(key, 'down');
      }
    }
  }

  private handleKeyUp(data: { key: string; modifiers: string[] }) {
    if (this.platform === 'win32') {
      const vkCode = this.keyToVirtualKeyCode(data.key);
      if (vkCode !== null) {
        this.execPowerShellInput('keyup', vkCode);
      }
    } else if (robot) {
      const key = this.mapKeyForRobot(data.key);
      if (data.modifiers && data.modifiers.length > 0) {
        const modifiers = data.modifiers.map(m => this.mapKeyForRobot(m));
        robot.keyToggle(key, 'up', modifiers);
      } else {
        robot.keyToggle(key, 'up');
      }
    }
  }

  private handleKeyPress(data: { text: string }) {
    if (this.platform === 'win32') {
      this.execPowerShellInput('typetext', data.text);
    } else if (robot) {
      robot.typeString(data.text);
    }
  }

  // ========== KEY MAPPING ==========

  // Mappa tasti web a Virtual Key Codes Windows
  private keyToVirtualKeyCode(key: string): number | null {
    const vkMap: { [key: string]: number } = {
      'Enter': 0x0D,
      'Backspace': 0x08,
      'Tab': 0x09,
      'Escape': 0x1B,
      ' ': 0x20,
      'ArrowLeft': 0x25,
      'ArrowUp': 0x26,
      'ArrowRight': 0x27,
      'ArrowDown': 0x28,
      'Delete': 0x2E,
      'Control': 0x11,
      'Shift': 0x10,
      'Alt': 0x12,
      'Home': 0x24,
      'End': 0x23,
      'PageUp': 0x21,
      'PageDown': 0x22
    };

    if (vkMap[key] !== undefined) {
      return vkMap[key];
    }

    // Per lettere singole A-Z
    if (key.length === 1) {
      const char = key.toUpperCase();
      if (char >= 'A' && char <= 'Z') {
        return char.charCodeAt(0);
      }
      if (char >= '0' && char <= '9') {
        return char.charCodeAt(0);
      }
    }

    return null;
  }

  // Mappa tasti web a robotjs
  private mapKeyForRobot(key: string): string {
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
