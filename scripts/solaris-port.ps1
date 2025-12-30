# PowerShell script that compiles and executes Solaris 2.0 GDI effects on the fly.
# Translated from original 1200+ lines C++ decompiled source.

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class SolarisPort {
    [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
    [DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);
    [DllImport("gdi32.dll")] public static extern bool PatBlt(IntPtr hdc, int nXLeft, int nYLeft, int nWidth, int nHeight, uint dwRop);
    [DllImport("gdi32.dll")] public static extern IntPtr CreateSolidBrush(uint crColor);
    [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);
    [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr hObject);
    [DllImport("gdi32.dll")] public static extern IntPtr CreateEllipticRgn(int nLeftRect, int nTopRect, int nRightRect, int nBottomRect);
    [DllImport("user32.dll")] public static extern int SelectClipRgn(IntPtr hdc, IntPtr hrgn);
    [DllImport("user32.dll")] public static extern bool InvalidateRect(IntPtr hWnd, IntPtr lpRect, bool bErase);
    [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")] public static extern bool RedrawWindow(IntPtr hWnd, IntPtr lprcUpdate, IntPtr hrgnUpdate, uint flags);
    [DllImport("gdi32.dll")] public static extern bool StretchBlt(IntPtr hdcDest, int nXOriginDest, int nYOriginDest, int nWidthDest, int nHeightDest, IntPtr hdcSrc, int nXOriginSrc, int nYOriginSrc, int nWidthSrc, int nHeightSrc, uint dwRop);
    [DllImport("gdi32.dll")] public static extern bool PlgBlt(IntPtr hdcDest, POINT[] lpPoint, IntPtr hdcSrc, int nXSrc, int nYSrc, int nWidth, int nHeight, IntPtr hbmMask, int xMask, int yMask);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int x, y;
        public POINT(int x, int y) { this.x = x; this.y = y; }
    }

    private static Random rand = new Random();

    public static void HITBMAP() {
        int w = GetSystemMetrics(0);
        int h = GetSystemMetrics(1);
        while (true) {
            IntPtr hdc = GetDC(IntPtr.Zero);
            SelectObject(hdc, (IntPtr)(rand.Next() % 40));
            PatBlt(hdc, 0, 0, w, h, 0x005A0049); // PATINVERT
            ReleaseDC(IntPtr.Zero, hdc);
            Thread.Sleep(1000);
        }
    }

    public static void Circle() {
        RECT rect;
        IntPtr desk = GetDesktopWindow();
        GetWindowRect(desk, out rect);
        int w = rect.Right - rect.Left;
        int h = rect.Bottom - rect.Top;
        while (true) {
            int v7 = rand.Next() % (w + 500) - 500;
            int v6 = rand.Next() % (h + 500) - 500;
            for (int j = 0; j <= 999; j += 10) {
                CircleInvert(j - v7, v6 - (v7 / 2), j, j);
                Thread.Sleep(10);
                InvalidateRect(IntPtr.Zero, IntPtr.Zero, false);
            }
        }
    }

    private static void CircleInvert(int a1, int a2, int a3, int a4) {
        IntPtr hdc = GetDC(IntPtr.Zero);
        IntPtr hrgn = CreateEllipticRgn(a1, a2, a1 + a3, a4 + a2);
        SelectClipRgn(hdc, hrgn);
        uint color = (uint)(rand.Next(255) | (rand.Next(255) << 8) | (rand.Next(255) << 16));
        IntPtr brush = CreateSolidBrush(color);
        SelectObject(hdc, brush);
        BitBlt(hdc, a1, a2, a3, a4, hdc, a1, a2, 0x2837E28);
        DeleteObject(hrgn);
        DeleteObject(brush);
        ReleaseDC(IntPtr.Zero, hdc);
    }

    public static void Shake() {
        int sw = GetSystemMetrics(0);
        int sh = GetSystemMetrics(1);
        double i = 0;
        while (true) {
            IntPtr hdc = GetDC(IntPtr.Zero);
            int v5 = (int)(Math.Sin(i) * 10);
            int v4 = (int)(Math.Cos(i) * 10);
            BitBlt(hdc, v4, v5, sw, sh, hdc, 0, 0, 0x00CC0020);
            ReleaseDC(IntPtr.Zero, hdc);
            i += 0.5;
            Thread.Sleep(50);
        }
    }

    public static void Dizzy() {
        while (true) {
            PlgEffect(10); // Right-ish
            PlgEffect(-10); // Left-ish
        }
    }

    private static void PlgEffect(int v10) {
        DateTime start = DateTime.Now;
        IntPtr hdc = GetDC(IntPtr.Zero);
        RECT rect;
        GetWindowRect(GetDesktopWindow(), out rect);
        while ((DateTime.Now - start).TotalSeconds < 5) {
            POINT[] pts = new POINT[3];
            pts[0] = new POINT(rect.Left + v10, rect.Top - v10);
            pts[1] = new POINT(rect.Right + v10, rect.Top + v10);
            pts[2] = new POINT(rect.Left - v10, rect.Bottom - v10);
            PlgBlt(hdc, pts, hdc, rect.Left, rect.top, rect.Right - rect.Left, rect.Bottom - rect.Top, IntPtr.Zero, 0, 0);
        }
        ReleaseDC(IntPtr.Zero, hdc);
    }

    public static void Cubes() {
        int sw = GetSystemMetrics(0);
        int sh = GetSystemMetrics(1);
        while (true) {
            IntPtr hdc = GetDC(IntPtr.Zero);
            StretchBlt(hdc, -10, -10, sw + 20, sh + 20, hdc, 0, 0, sw, sh, 0x00CC0020);
            Thread.Sleep(100);
            StretchBlt(hdc, 10, 10, sw - 20, sh - 20, hdc, 0, 0, sw, sh, 0x00CC0020);
            ReleaseDC(IntPtr.Zero, hdc);
            Thread.Sleep(100);
        }
    }

    public static void Dun() {
        int sw = GetSystemMetrics(0);
        int sh = GetSystemMetrics(1);
        while (true) {
            IntPtr hdc = GetDC(IntPtr.Zero);
            int y = rand.Next() % sw;
            int h = sh - (rand.Next() % sh) + 58 - (sh / 2);
            IntPtr brush = CreateSolidBrush((uint)(rand.Next(255) << (rand.Next(3) * 8)));
            SelectObject(hdc, brush);
            PatBlt(hdc, 0, y, sw, h, 0x00550009); // PATPAINT style
            DeleteObject(brush);
            ReleaseDC(IntPtr.Zero, hdc);
            Thread.Sleep(10);
        }
    }

    public static void MainExecution(int durationSeconds) {
        new Thread(HITBMAP) { IsBackground = true }.Start();
        new Thread(Circle) { IsBackground = true }.Start();
        new Thread(Shake) { IsBackground = true }.Start();
        new Thread(Dizzy) { IsBackground = true }.Start();
        new Thread(Cubes) { IsBackground = true }.Start();
        new Thread(Dun) { IsBackground = true }.Start();
        
        Thread.Sleep(durationSeconds * 1000);
        
        for (int i = 0; i < 10; i++) {
            RedrawWindow(IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0x85);
            Thread.Sleep(100);
        }
    }
}
"@

# Start the audio drone in background
$audioJob = Start-Job -ScriptBlock {
    $start = Get-Date
    while ((Get-Date) -lt $start.AddSeconds(60)) {
        [System.Console]::Beep((Get-Random -Min 100 -Max 1000), 100)
    }
}

# Volume Up 100%
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class AudioHelper {
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    public static void MaxVol() { for(int i=0; i<50; i++) keybd_event(0xAF, 0, 0, 0); }
}
"@
[AudioHelper]::MaxVol()

# Execute GDI Solaris Port
[SolarisPort]::MainExecution(60)

Stop-Job $audioJob
Remove-Job $audioJob
