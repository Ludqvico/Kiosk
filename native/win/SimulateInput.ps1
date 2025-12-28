# Script PowerShell per simulare input mouse e tastiera su Windows
# Alternativa a robotjs che non richiede Visual Studio Build Tools

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class InputSimulator {
    // Mouse functions
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

    // Mouse event flags
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;

    // Keyboard functions
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const uint KEYEVENTF_KEYDOWN = 0x0000;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    // Virtual key codes (alcuni comuni)
    public const byte VK_RETURN = 0x0D;
    public const byte VK_BACK = 0x08;
    public const byte VK_TAB = 0x09;
    public const byte VK_ESCAPE = 0x1B;
    public const byte VK_SPACE = 0x20;
    public const byte VK_LEFT = 0x25;
    public const byte VK_UP = 0x26;
    public const byte VK_RIGHT = 0x27;
    public const byte VK_DOWN = 0x28;
    public const byte VK_DELETE = 0x2E;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_SHIFT = 0x10;
    public const byte VK_ALT = 0x12;

    // Funzioni helper
    public static void MoveMouse(int x, int y) {
        SetCursorPos(x, y);
    }

    public static void ClickLeft(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(10);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void ClickRight(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(10);
        mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void MouseDown(bool isLeft) {
        if (isLeft) {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        } else {
            mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
        }
    }

    public static void MouseUp(bool isLeft) {
        if (isLeft) {
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        } else {
            mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
        }
    }

    public static void KeyDown(byte vkCode) {
        keybd_event(vkCode, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
    }

    public static void KeyUp(byte vkCode) {
        keybd_event(vkCode, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void KeyPress(byte vkCode) {
        keybd_event(vkCode, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
        System.Threading.Thread.Sleep(10);
        keybd_event(vkCode, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@

# Gestione comandi
$command = $args[0]

switch ($command) {
    "mousemove" {
        $x = [int]$args[1]
        $y = [int]$args[2]
        [InputSimulator]::MoveMouse($x, $y)
        Write-Output "OK"
    }

    "click" {
        $x = [int]$args[1]
        $y = [int]$args[2]
        $button = $args[3]

        if ($button -eq "right") {
            [InputSimulator]::ClickRight($x, $y)
        } else {
            [InputSimulator]::ClickLeft($x, $y)
        }
        Write-Output "OK"
    }

    "mousedown" {
        $button = $args[1]
        [InputSimulator]::MouseDown($button -eq "left")
        Write-Output "OK"
    }

    "mouseup" {
        $button = $args[1]
        [InputSimulator]::MouseUp($button -eq "left")
        Write-Output "OK"
    }

    "keydown" {
        $vkCode = [byte]$args[1]
        [InputSimulator]::KeyDown($vkCode)
        Write-Output "OK"
    }

    "keyup" {
        $vkCode = [byte]$args[1]
        [InputSimulator]::KeyUp($vkCode)
        Write-Output "OK"
    }

    "keypress" {
        $vkCode = [byte]$args[1]
        [InputSimulator]::KeyPress($vkCode)
        Write-Output "OK"
    }

    "typetext" {
        $text = $args[1]

        # Usa SendKeys per testo
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait($text)
        Write-Output "OK"
    }

    default {
        Write-Output "UNKNOWN_COMMAND"
    }
}
