param([string]$action = "block")

# Script PowerShell per bloccare INPUT a livello SISTEMA usando Low-Level Hooks
# Questo è il BLOCCO BRUTALE tipo "Alcatraz" - intercetta TUTTO prima che arrivi alle app

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Windows.Forms;

public class SystemInputBlocker
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WH_MOUSE_LL = 14;
    private static IntPtr keyboardHookID = IntPtr.Zero;
    private static IntPtr mouseHookID = IntPtr.Zero;
    private static LowLevelKeyboardProc keyboardProc = KeyboardHookCallback;
    private static LowLevelMouseProc mouseProc = MouseHookCallback;

    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    public delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern bool BlockInput(bool fBlockIt);

    // Keyboard hook callback - BLOCCA TUTTO
    private static IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            // Ritorna 1 per bloccare l'evento - NON chiamare CallNextHookEx
            return (IntPtr)1;
        }
        return CallNextHookEx(keyboardHookID, nCode, wParam, lParam);
    }

    // Mouse hook callback - BLOCCA TUTTO
    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            // Ritorna 1 per bloccare l'evento - NON chiamare CallNextHookEx
            return (IntPtr)1;
        }
        return CallNextHookEx(mouseHookID, nCode, wParam, lParam);
    }

    public static bool InstallHooks()
    {
        try
        {
            IntPtr hInstance = GetModuleHandle(Process.GetCurrentProcess().MainModule.ModuleName);

            // Installa keyboard hook
            keyboardHookID = SetWindowsHookEx(WH_KEYBOARD_LL, keyboardProc, hInstance, 0);
            if (keyboardHookID == IntPtr.Zero)
            {
                Console.WriteLine("ERROR: Failed to install keyboard hook");
                return false;
            }

            // Installa mouse hook
            mouseHookID = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, hInstance, 0);
            if (mouseHookID == IntPtr.Zero)
            {
                Console.WriteLine("ERROR: Failed to install mouse hook");
                UnhookWindowsHookEx(keyboardHookID);
                return false;
            }

            // Usa anche BlockInput API come layer aggiuntivo
            BlockInput(true);

            Console.WriteLine("HOOKS_INSTALLED");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
            return false;
        }
    }

    public static void RemoveHooks()
    {
        try
        {
            if (keyboardHookID != IntPtr.Zero)
            {
                UnhookWindowsHookEx(keyboardHookID);
                keyboardHookID = IntPtr.Zero;
            }
            if (mouseHookID != IntPtr.Zero)
            {
                UnhookWindowsHookEx(mouseHookID);
                mouseHookID = IntPtr.Zero;
            }
            BlockInput(false);
            Console.WriteLine("HOOKS_REMOVED");
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }

    public static void RunMessageLoop(string stopFile)
    {
        // Message loop per mantenere gli hook attivi
        // Controlla ogni 100ms se esiste il file di stop
        while (!System.IO.File.Exists(stopFile))
        {
            Application.DoEvents();
            System.Threading.Thread.Sleep(100);
        }
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

# File di controllo per fermare il blocco
$stopFile = "$env:TEMP\input_blocker_stop.flag"

if ($action -eq "block") {
    # Rimuovi vecchio file stop se esiste
    if (Test-Path $stopFile) {
        Remove-Item $stopFile -Force
    }

    # Installa hooks
    $result = [SystemInputBlocker]::InstallHooks()
    if ($result) {
        Write-Host "BLOCKED"
        # Mantieni processo attivo con message loop
        [SystemInputBlocker]::RunMessageLoop($stopFile)
        # Quando esce dal loop, rimuovi hooks
        [SystemInputBlocker]::RemoveHooks()
    } else {
        Write-Host "FAILED"
    }
}
elseif ($action -eq "unblock") {
    # Crea file di stop per terminare il processo di blocco
    "STOP" | Out-File -FilePath $stopFile -Force
    Write-Host "UNBLOCKED"
}
else {
    Write-Host "ERROR: Unknown action '$action'. Use 'block' or 'unblock'"
}
