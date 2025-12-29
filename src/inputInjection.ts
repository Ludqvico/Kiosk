import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Input Injection Cross-Platform
 *
 * Simula input mouse e tastiera usando API native:
 * - Mac: osascript (AppleScript)
 * - Windows: Persistent PowerShell process (per performance)
 * - Linux: xdotool
 */
export class InputInjection {
  private platform: string;
  private screenWidth: number;
  private screenHeight: number;
  private windowsPowerShell: ChildProcess | null = null;
  private psReady: boolean = false;

  constructor(screenWidth: number, screenHeight: number) {
    this.platform = process.platform;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    console.log(`[InputInjection] Initialized for ${this.platform} (${screenWidth}x${screenHeight})`);

    // Initialize persistent PowerShell on Windows
    if (this.platform === 'win32') {
      this.initWindowsPowerShell();
    }
  }

  private initWindowsPowerShell() {
    console.log('[InputInjection] Starting persistent PowerShell process...');

    this.windowsPowerShell = spawn('powershell.exe', [
      '-NoProfile',
      '-NoLogo',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', '-'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Buffer for collecting output
    let stdoutBuffer = '';
    let stderrBuffer = '';

    this.windowsPowerShell.stdout?.on('data', (data) => {
      const output = data.toString();
      stdoutBuffer += output;

      if (output.includes('READY')) {
        this.psReady = true;
        console.log('[InputInjection] PowerShell process ready');
      } else if (output.trim() !== 'True' && output.trim() !== '') {
        // Log only meaningful output, skip "True" success returns
        console.log('[InputInjection] PowerShell stdout:', output.trim());
      }
    });

    this.windowsPowerShell.stderr?.on('data', (data) => {
      const error = data.toString();
      stderrBuffer += error;
      console.error('[InputInjection] PowerShell stderr:', error.trim());
    });

    this.windowsPowerShell.on('exit', (code) => {
      console.error('[InputInjection] PowerShell process exited with code:', code);
      if (stderrBuffer) {
        console.error('[InputInjection] Full stderr output:', stderrBuffer);
      }
      this.psReady = false;
      this.windowsPowerShell = null;
    });

    // Initialize C# types once - use simpler approach with direct command
    const initScript = `Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinInput {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);
}
"@
Write-Output "READY"
`;

    this.windowsPowerShell.stdin?.write(initScript + '\n');
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
   * Mouse button down (press without release - for drag operations)
   */
  async mouseDown(normalizedX: number, normalizedY: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    const x = Math.round(normalizedX * this.screenWidth);
    const y = Math.round(normalizedY * this.screenHeight);

    try {
      if (this.platform === 'darwin') {
        await this.macMouseDown(x, y, button);
      } else if (this.platform === 'win32') {
        await this.windowsMouseDown(x, y, button);
      } else if (this.platform === 'linux') {
        await this.linuxMouseDown(x, y, button);
      }
    } catch (error) {
      console.error(`[InputInjection] Error mouseDown ${button} at (${x}, ${y}):`, error);
    }
  }

  /**
   * Mouse button up (release after drag)
   */
  async mouseUp(normalizedX: number, normalizedY: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    const x = Math.round(normalizedX * this.screenWidth);
    const y = Math.round(normalizedY * this.screenHeight);

    try {
      if (this.platform === 'darwin') {
        await this.macMouseUp(x, y, button);
      } else if (this.platform === 'win32') {
        await this.windowsMouseUp(x, y, button);
      } else if (this.platform === 'linux') {
        await this.linuxMouseUp(x, y, button);
      }
    } catch (error) {
      console.error(`[InputInjection] Error mouseUp ${button} at (${x}, ${y}):`, error);
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

  private async macMouseDown(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    const script = `
      tell application "System Events"
        set position of mouse to {${x}, ${y}}
        mouse down
      end tell
    `;
    await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
  }

  private async macMouseUp(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    const script = `
      tell application "System Events"
        set position of mouse to {${x}, ${y}}
        mouse up
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
    if (!this.psReady || !this.windowsPowerShell?.stdin) {
      console.error('[InputInjection] PowerShell not ready for mouse move');
      return;
    }

    // Use persistent PowerShell process with SetCursorPos for fast mouse movement
    this.windowsPowerShell.stdin.write(`[WinInput]::SetCursorPos(${x}, ${y});\n`);
  }

  private async windowsClick(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    if (!this.psReady || !this.windowsPowerShell?.stdin) {
      console.error('[InputInjection] PowerShell not ready for click');
      return;
    }

    let downFlag: string;
    let upFlag: string;

    if (button === 'left') {
      downFlag = '0x0002'; // LEFTDOWN
      upFlag = '0x0004';   // LEFTUP
    } else if (button === 'right') {
      downFlag = '0x0008'; // RIGHTDOWN
      upFlag = '0x0010';   // RIGHTUP
    } else {
      downFlag = '0x0020'; // MIDDLEDOWN
      upFlag = '0x0040';   // MIDDLEUP
    }

    // Use persistent PowerShell process - move mouse, then click
    const clickScript = `
[WinInput]::SetCursorPos(${x}, ${y});
Start-Sleep -Milliseconds 10;
[WinInput]::mouse_event(${downFlag}, 0, 0, 0, [UIntPtr]::Zero);
[WinInput]::mouse_event(${upFlag}, 0, 0, 0, [UIntPtr]::Zero);
`;
    this.windowsPowerShell.stdin.write(clickScript);
  }

  private async windowsMouseDown(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    if (!this.psReady || !this.windowsPowerShell?.stdin) {
      console.error('[InputInjection] PowerShell not ready for mousedown');
      return;
    }

    let downFlag: string;

    if (button === 'left') {
      downFlag = '0x0002'; // LEFTDOWN
    } else if (button === 'right') {
      downFlag = '0x0008'; // RIGHTDOWN
    } else {
      downFlag = '0x0020'; // MIDDLEDOWN
    }

    // Move to position and press button (but don't release - for drag)
    const downScript = `
[WinInput]::SetCursorPos(${x}, ${y});
Start-Sleep -Milliseconds 5;
[WinInput]::mouse_event(${downFlag}, 0, 0, 0, [UIntPtr]::Zero);
`;
    this.windowsPowerShell.stdin.write(downScript);
  }

  private async windowsMouseUp(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    if (!this.psReady || !this.windowsPowerShell?.stdin) {
      console.error('[InputInjection] PowerShell not ready for mouseup');
      return;
    }

    let upFlag: string;

    if (button === 'left') {
      upFlag = '0x0004';   // LEFTUP
    } else if (button === 'right') {
      upFlag = '0x0010';   // RIGHTUP
    } else {
      upFlag = '0x0040';   // MIDDLEUP
    }

    // Move to position and release button (end of drag)
    const upScript = `
[WinInput]::SetCursorPos(${x}, ${y});
[WinInput]::mouse_event(${upFlag}, 0, 0, 0, [UIntPtr]::Zero);
`;
    this.windowsPowerShell.stdin.write(upScript);
  }

  private async windowsKeyPress(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }): Promise<void> {
    if (!this.psReady || !this.windowsPowerShell?.stdin) {
      console.error('[InputInjection] PowerShell not ready for keypress');
      return;
    }

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

    // Escape double quotes for PowerShell
    const escapedKey = sendKey.replace(/"/g, '""');

    // Use persistent PowerShell process
    this.windowsPowerShell.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait("${escapedKey}");\n`);
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

  private async linuxMouseDown(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    let btn: string;
    if (button === 'left') {
      btn = '1';
    } else if (button === 'right') {
      btn = '3';
    } else {
      btn = '2'; // middle
    }
    await execAsync(`xdotool mousemove ${x} ${y} mousedown ${btn}`);
  }

  private async linuxMouseUp(x: number, y: number, button: 'left' | 'right' | 'middle'): Promise<void> {
    let btn: string;
    if (button === 'left') {
      btn = '1';
    } else if (button === 'right') {
      btn = '3';
    } else {
      btn = '2'; // middle
    }
    await execAsync(`xdotool mousemove ${x} ${y} mouseup ${btn}`);
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

  /**
   * Cleanup: chiude il processo PowerShell persistente
   */
  cleanup(): void {
    if (this.windowsPowerShell) {
      console.log('[InputInjection] Closing persistent PowerShell process...');
      try {
        this.windowsPowerShell.stdin?.write('exit\n');
        this.windowsPowerShell.kill();
      } catch (error) {
        console.error('[InputInjection] Error closing PowerShell:', error);
      }
      this.windowsPowerShell = null;
      this.psReady = false;
    }
  }
}
