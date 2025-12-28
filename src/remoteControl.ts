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
  private frameCount = 0;

  constructor() {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      this.screenWidth = primaryDisplay.size.width;
      this.screenHeight = primaryDisplay.size.height;
      console.log(`[RemoteControl] Inizializzato - ${this.platform} - Screen: ${this.screenWidth}x${this.screenHeight}`);
    } catch (error) {
      console.error('[RemoteControl] ERRORE in constructor:', error);
      this.screenWidth = 1920;
      this.screenHeight = 1080;
    }
  }

  // Avvia cattura schermo
  async startCapture(fps: number = 10) {
    try {
      if (this.isCapturing) {
        console.log('[RemoteControl] Screen capture già attivo');
        return;
      }

      this.isCapturing = true;
      const intervalMs = 1000 / fps;

      this.captureInterval = setInterval(async () => {
        await this.captureFrame();
      }, intervalMs);

      console.log(`[RemoteControl] Cattura avviata - ${fps} FPS (640x360)`);
    } catch (error) {
      console.error('[RemoteControl] ERRORE in startCapture():', error);
      this.isCapturing = false;
    }
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
          width: 640,  // Ridotto per evitare payload troppo grandi (era 1280x720 = 1.6MB)
          height: 360  // 640x360 = ~400KB - Socket.io gestisce bene questo size
        }
      });

      if (sources.length === 0) {
        console.error('[RemoteControl] Nessuna sorgente schermo trovata');
        return;
      }

      const source = sources[0];
      const thumbnail = source.thumbnail;
      const dataUrl = thumbnail.toDataURL();
      const size = thumbnail.getSize();

      this.frameCount++;

      // Log ogni 30 frame (~3 secondi a 10 FPS) per non spammare
      if (this.frameCount % 30 === 0) {
        const kb = Math.round(dataUrl.length / 1024);
        console.log(`[RemoteControl] Frame #${this.frameCount}: ${size.width}x${size.height} (${kb} KB)`);
      }

      if (this.onFrameCallback) {
        this.onFrameCallback(dataUrl, size.width, size.height);
      }
    } catch (error) {
      console.error('[RemoteControl] ERRORE cattura frame:', error);
      // NON fermare - continua a provare
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
      // __dirname = dist/, quindi lo script è in dist/native/win/SimulateInput.ps1
      const scriptPath = path.join(__dirname, 'native', 'win', 'SimulateInput.ps1');
      const psArgs = args.map(a => `"${a}"`).join(' ');
      const fullCommand = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" ${command} ${psArgs}`;

      console.log(`[RemoteControl] Executing: ${command} ${args.join(', ')}`);
      console.log(`[RemoteControl] Script path: ${scriptPath}`);

      const result = execSync(fullCommand, {
        encoding: 'utf8',
        timeout: 2000,
        windowsHide: true
      }).trim();

      console.log(`[RemoteControl] PowerShell result: ${result}`);

      const success = result === 'OK';
      if (!success) {
        console.error(`[RemoteControl] ERROR: PowerShell returned: ${result}`);
      }

      return success;
    } catch (error) {
      console.error('[RemoteControl] ERROR executing PowerShell:', error);
      return false;
    }
  }

  // ========== MOUSE HANDLERS ==========

  private handleMouseMove(data: { x: number; y: number }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);

    console.log(`[RemoteControl] MouseMove: ${data.x.toFixed(2)},${data.y.toFixed(2)} -> ${x},${y} (screen: ${this.screenWidth}x${this.screenHeight})`);

    if (this.platform === 'win32') {
      this.execPowerShellInput('mousemove', x, y);
    } else if (robot) {
      robot.moveMouse(x, y);
    }
  }

  private handleMouseDown(data: { x: number; y: number; button: string }) {
    const x = Math.round(data.x * this.screenWidth);
    const y = Math.round(data.y * this.screenHeight);
    const button = data.button === 'right' ? 'right' : 'left';

    console.log(`[RemoteControl] MouseDown: ${button} at ${x},${y}`);

    if (this.platform === 'win32') {
      this.execPowerShellInput('mousemove', x, y);
      this.execPowerShellInput('mousedown', button);
    } else if (robot) {
      robot.moveMouse(x, y);
      robot.mouseToggle('down', button);
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
    const button = data.button === 'right' ? 'right' : 'left';

    console.log(`[RemoteControl] Click: ${button} at ${x},${y}`);

    if (this.platform === 'win32') {
      this.execPowerShellInput('click', x, y, button);
    } else if (robot) {
      robot.moveMouse(x, y);
      robot.mouseClick(button);
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
