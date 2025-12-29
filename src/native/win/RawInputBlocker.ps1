param([string]$action = "block")

# RAW INPUT BLOCKER - Blocca input FISICI ma permette input SIMULATI (robotjs SendInput)
# Usa RegisterRawInputDevices con RIDEV_NOLEGACY per bloccare input da device hardware

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class RawInputBlocker
{
    // Raw Input structures
    [StructLayout(LayoutKind.Sequential)]
    public struct RAWINPUTDEVICE
    {
        public ushort usUsagePage;
        public ushort usUsage;
        public uint dwFlags;
        public IntPtr hwndTarget;
    }

    // Raw Input flags
    private const uint RIDEV_INPUTSINK = 0x00000100;
    private const uint RIDEV_NOLEGACY = 0x00000030;  // Blocca legacy messages (WM_KEYDOWN, WM_MOUSEMOVE, etc)
    private const uint RIDEV_REMOVE = 0x00000001;

    // Usage pages
    private const ushort HID_USAGE_PAGE_GENERIC = 0x01;
    private const ushort HID_USAGE_GENERIC_MOUSE = 0x02;
    private const ushort HID_USAGE_GENERIC_KEYBOARD = 0x06;

    [DllImport("user32.dll")]
    private static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);

    [DllImport("user32.dll")]
    private static extern IntPtr CreateWindowEx(uint dwExStyle, string lpClassName, string lpWindowName,
        uint dwStyle, int x, int y, int nWidth, int nHeight, IntPtr hWndParent, IntPtr hMenu, IntPtr hInstance, IntPtr lpParam);

    [DllImport("user32.dll")]
    private static extern bool DestroyWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr DefWindowProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam);

    private static IntPtr messageWindow = IntPtr.Zero;

    public static bool BlockPhysicalInput()
    {
        try
        {
            // Crea finestra invisibile per ricevere raw input messages
            messageWindow = CreateWindowEx(0, "Static", "RawInputBlocker", 0, 0, 0, 0, 0, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);

            if (messageWindow == IntPtr.Zero)
            {
                Console.WriteLine("ERROR: Failed to create message window");
                return false;
            }

            RAWINPUTDEVICE[] devices = new RAWINPUTDEVICE[2];

            // MOUSE - Blocca input da mouse fisici
            devices[0].usUsagePage = HID_USAGE_PAGE_GENERIC;
            devices[0].usUsage = HID_USAGE_GENERIC_MOUSE;
            devices[0].dwFlags = RIDEV_INPUTSINK | RIDEV_NOLEGACY;  // NOLEGACY blocca WM_MOUSEMOVE, etc
            devices[0].hwndTarget = messageWindow;

            // KEYBOARD - Blocca input da tastiere fisiche
            devices[1].usUsagePage = HID_USAGE_PAGE_GENERIC;
            devices[1].usUsage = HID_USAGE_GENERIC_KEYBOARD;
            devices[1].dwFlags = RIDEV_INPUTSINK | RIDEV_NOLEGACY;  // NOLEGACY blocca WM_KEYDOWN, etc
            devices[1].hwndTarget = messageWindow;

            bool success = RegisterRawInputDevices(devices, (uint)devices.Length, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));

            if (!success)
            {
                Console.WriteLine("ERROR: RegisterRawInputDevices failed");
                return false;
            }

            Console.WriteLine("BLOCKED");
            Console.WriteLine("INFO: Input FISICI bloccati (mouse/tastiera hardware)");
            Console.WriteLine("INFO: SendInput (robotjs) funziona normalmente");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
            return false;
        }
    }

    public static bool UnblockPhysicalInput()
    {
        try
        {
            RAWINPUTDEVICE[] devices = new RAWINPUTDEVICE[2];

            // Remove mouse blocking
            devices[0].usUsagePage = HID_USAGE_PAGE_GENERIC;
            devices[0].usUsage = HID_USAGE_GENERIC_MOUSE;
            devices[0].dwFlags = RIDEV_REMOVE;
            devices[0].hwndTarget = IntPtr.Zero;

            // Remove keyboard blocking
            devices[1].usUsagePage = HID_USAGE_PAGE_GENERIC;
            devices[1].usUsage = HID_USAGE_GENERIC_KEYBOARD;
            devices[1].dwFlags = RIDEV_REMOVE;
            devices[1].hwndTarget = IntPtr.Zero;

            bool success = RegisterRawInputDevices(devices, (uint)devices.Length, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));

            if (messageWindow != IntPtr.Zero)
            {
                DestroyWindow(messageWindow);
                messageWindow = IntPtr.Zero;
            }

            Console.WriteLine("UNBLOCKED");
            return success;
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
            return false;
        }
    }

    public static void RunMessageLoop(string stopFile)
    {
        // Message loop per mantenere il processo attivo
        while (!System.IO.File.Exists(stopFile))
        {
            Application.DoEvents();
            System.Threading.Thread.Sleep(100);
        }
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

# File di controllo per fermare il blocco
$stopFile = "$env:TEMP\rawinput_blocker_stop.flag"

if ($action -eq "block") {
    # Rimuovi vecchio file stop se esiste
    if (Test-Path $stopFile) {
        Remove-Item $stopFile -Force
    }

    # Blocca input fisici
    $result = [RawInputBlocker]::BlockPhysicalInput()
    if ($result) {
        # Mantieni processo attivo con message loop
        [RawInputBlocker]::RunMessageLoop($stopFile)
        # Quando esce dal loop, sblocca
        [RawInputBlocker]::UnblockPhysicalInput()
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
