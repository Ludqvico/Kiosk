# Low-level keyboard hook to block Windows key and other system shortcuts
# This script runs as a background process and blocks specific keys

Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class KeyboardHook
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    
    // Keys to block
    private static readonly int VK_LWIN = 0x5B;
    private static readonly int VK_RWIN = 0x5C;
    private static readonly int VK_ESCAPE = 0x1B;
    private static readonly int VK_TAB = 0x09;
    private static readonly int VK_DELETE = 0x2E;
    
    private static IntPtr _hookID = IntPtr.Zero;
    private static LowLevelKeyboardProc _proc = HookCallback;
    
    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);
    
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);
    
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);
    
    public static void Start()
    {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule)
        {
            _hookID = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule.ModuleName), 0);
        }
        Application.Run();
    }
    
    public static void Stop()
    {
        UnhookWindowsHookEx(_hookID);
        Application.Exit();
    }
    
    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN))
        {
            int vkCode = Marshal.ReadInt32(lParam);
            
            // Block Windows keys
            if (vkCode == VK_LWIN || vkCode == VK_RWIN)
            {
                return (IntPtr)1;
            }
            
            // Get modifier keys state
            bool ctrl = (Control.ModifierKeys & Keys.Control) != 0;
            bool alt = (Control.ModifierKeys & Keys.Alt) != 0;
            bool shift = (Control.ModifierKeys & Keys.Shift) != 0;
            
            // Block Ctrl+Escape (Start menu)
            if (ctrl && vkCode == VK_ESCAPE)
            {
                return (IntPtr)1;
            }
            
            // Block Alt+Tab
            if (alt && vkCode == VK_TAB)
            {
                return (IntPtr)1;
            }
            
            // Block Ctrl+Shift+Escape (Task Manager)
            if (ctrl && shift && vkCode == VK_ESCAPE)
            {
                return (IntPtr)1;
            }
            
            // Block Alt+F4
            if (alt && vkCode == 0x73) // F4
            {
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

# Start the hook
[KeyboardHook]::Start()
