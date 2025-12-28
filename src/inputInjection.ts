import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Input Injection Cross-Platform
 *
 * Simula input mouse e tastiera usando API native:
 * - Mac: osascript (AppleScript)
 * - Windows: PowerShell con Add-Type C#
 * - Linux: xdotool
 */
export class InputInjection {
  private platform: string;
  private screenWidth: number;
  private screenHeight: number;

  constructor(screenWidth: number, screenHeight: number) {
    this.platform = process.platform;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    console.log(`[InputInjection] Initialized for ${this.platform} (${screenWidth}x${screenHeight})`);
  }

  /**
   * Muove il mouse alle coordinate normalizzate (0-1)
   */
  async moveMouse(normalizedX: number, normalizedY: number): Promise<void> {
    const x = Math.round(normalizedX * this.screenWidth);
    const y = Math.round(normalizedY * this.screenHeight);

    try {
      if (this.platform === 'darwin') {
        await this.macMoveMouse(x, y);
      } else if (this.platform === 'win32') {
        await this.windowsMoveMouse(x, y);
      } else if (this.platform === 'linux') {
        await this.linuxMoveMouse(x, y);
      }
    } catch (error) {
      console.error('[InputInjection] Error moving mouse:', error);
    }
  }

  /**
   * Click del mouse
   */
  async click(normalizedX: number, normalizedY: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    const x = Math.round(normalizedX * this.screenWidth);
    const y = Math.round(normalizedY * this.screenHeight);

    console.log(`[InputInjection] CLICK ${button} at (${x}, ${y})`);

    try {
      if (this.platform === 'darwin') {
        await this.macClick(x, y, button);
      } else if (this.platform === 'win32') {
        await this.windowsClick(x, y, button);
      } else if (this.platform === 'linux') {
        await this.linuxClick(x, y, button);
      }
      console.log(`[InputInjection] CLICK ${button} DONE`);
    } catch (error) {
      console.error(`[InputInjection] Error clicking ${button} at (${x}, ${y}):`, error);
    }
  }

  /**
   * Pressione tasto
   */
  async keyPress(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }): Promise<void> {
    const mods = [];
    if (modifiers?.ctrl) mods.push('Ctrl');
    if (modifiers?.shift) mods.push('Shift');
    if (modifiers?.alt) mods.push('Alt');
    if (modifiers?.meta) mods.push('Meta');
    const modsStr = mods.length > 0 ? mods.join('+') + '+' : '';
    console.log(`[InputInjection] KEYPRESS ${modsStr}${key}`);

    try {
      if (this.platform === 'darwin') {
        await this.macKeyPress(key, modifiers);
      } else if (this.platform === 'win32') {
        await this.windowsKeyPress(key, modifiers);
      } else if (this.platform === 'linux') {
        await this.linuxKeyPress(key, modifiers);
      }
      console.log(`[InputInjection] KEYPRESS ${modsStr}${key} DONE`);
    } catch (error) {
      console.error(`[InputInjection] Error pressing key ${modsStr}${key}:`, error);
    }
  }

  // ========== MAC IMPLEMENTATION (AppleScript) ==========

  private async macMoveMouse(x: number, y: number): Promise<void> {
    const script = `
      tell application "System Events"
        set position of mouse to {${x}, ${y}}
      end tell
    `;
    await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
  }

  private async macClick(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    let clickCommand = 'click';
    if (button === 'right') {
      clickCommand = 'click at {' + x + ', ' + y + '} using {control down}';
    } else if (button === 'middle') {
      // Middle click not easily supported in AppleScript, skip
      console.warn('[InputInjection] Middle click not supported on macOS');
      return;
    } else {
      clickCommand = 'click at {' + x + ', ' + y + '}';
    }

    const script = `
      tell application "System Events"
        set position of mouse to {${x}, ${y}}
        ${clickCommand}
      end tell
    `;
    await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
  }

  private async macKeyPress(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }): Promise<void> {
    const mods: string[] = [];
    if (modifiers?.ctrl) mods.push('control down');
    if (modifiers?.shift) mods.push('shift down');
    if (modifiers?.alt) mods.push('option down');
    if (modifiers?.meta) mods.push('command down');

    const using = mods.length > 0 ? `using {${mods.join(', ')}}` : '';
    const script = `
      tell application "System Events"
        keystroke "${key.replace(/"/g, '\\"')}" ${using}
      end tell
    `;
    await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
  }

  // ========== WINDOWS IMPLEMENTATION (PowerShell C#) ==========

  private async windowsMoveMouse(x: number, y: number): Promise<void> {
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms;
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
    `;
    await execAsync(`powershell -ExecutionPolicy Bypass -Command "${ps}"`);
  }

  private async windowsClick(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    let mouseEvent: string;
    if (button === 'left') {
      mouseEvent = '0x0002, 0x0004'; // LEFTDOWN + LEFTUP
    } else if (button === 'right') {
      mouseEvent = '0x0008, 0x0010'; // RIGHTDOWN + RIGHTUP
    } else {
      mouseEvent = '0x0020, 0x0040'; // MIDDLEDOWN + MIDDLEUP
    }

    const ps = `
      Add-Type -AssemblyName System.Windows.Forms;
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y});
      Start-Sleep -Milliseconds 50;
      Add-Type @'
        using System;
        using System.Runtime.InteropServices;
        public class Mouse {
          [DllImport("user32.dll")]
          public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);
        }
'@;
      [Mouse]::mouse_event(${mouseEvent}, 0, 0, 0, [UIntPtr]::Zero)
    `;

    try {
      const result = await execAsync(`powershell -ExecutionPolicy Bypass -Command "${ps}"`);
      if (result.stderr) {
        console.error('[InputInjection] PowerShell stderr:', result.stderr);
      }
    } catch (error: any) {
      console.error('[InputInjection] PowerShell error:', error.message);
      throw error;
    }
  }

  private async windowsKeyPress(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }): Promise<void> {
    // Map special keys to SendKeys format
    const keyMap: Record<string, string> = {
      'Enter': '{ENTER}',
      'Tab': '{TAB}',
      'Backspace': '{BACKSPACE}',
      'Delete': '{DELETE}',
      'Escape': '{ESC}',
      'ArrowUp': '{UP}',
      'ArrowDown': '{DOWN}',
      'ArrowLeft': '{LEFT}',
      'ArrowRight': '{RIGHT}',
      'Home': '{HOME}',
      'End': '{END}',
      'PageUp': '{PGUP}',
      'PageDown': '{PGDN}',
      ' ': ' '
    };

    let sendKey = keyMap[key] || key;

    // Add modifiers (SendKeys format: ^ = Ctrl, + = Shift, % = Alt)
    if (modifiers?.ctrl) sendKey = '^' + sendKey;
    if (modifiers?.shift) sendKey = '+' + sendKey;
    if (modifiers?.alt) sendKey = '%' + sendKey;
    // Note: Windows meta key (Win key) is not easily supported via SendKeys

    const ps = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${sendKey.replace(/"/g, '\\"')}")
    `;
    await execAsync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`);
  }

  // ========== LINUX IMPLEMENTATION (xdotool) ==========

  private async linuxMoveMouse(x: number, y: number): Promise<void> {
    await execAsync(`xdotool mousemove ${x} ${y}`);
  }

  private async linuxClick(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    let btn: string;
    if (button === 'left') {
      btn = '1';
    } else if (button === 'right') {
      btn = '3';
    } else {
      btn = '2'; // middle
    }
    await execAsync(`xdotool mousemove ${x} ${y} click ${btn}`);
  }

  private async linuxKeyPress(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }): Promise<void> {
    const mods: string[] = [];
    if (modifiers?.ctrl) mods.push('ctrl');
    if (modifiers?.shift) mods.push('shift');
    if (modifiers?.alt) mods.push('alt');
    if (modifiers?.meta) mods.push('super');

    const keyStr = mods.length > 0 ? `${mods.join('+')}+${key}` : key;
    await execAsync(`xdotool key ${keyStr}`);
  }

  /**
   * Aggiorna dimensioni schermo
   */
  updateScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    console.log(`[InputInjection] Screen size updated: ${width}x${height}`);
  }
}
