Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class GDI {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateSolidBrush(uint crColor);

    [DllImport("gdi32.dll")]
    public static extern bool PatBlt(IntPtr hdc, int nXLeft, int nYLeft, int nWidth, int nHeight, uint dwRop);

    [DllImport("user32.dll")]
    public static extern bool InvertRect(IntPtr hDC, ref RECT lprc);

    [DllImport("gdi32.dll")]
    public static extern bool StretchBlt(IntPtr hdcDest, int nXOriginDest, int nYOriginDest, int nWidthDest, int nHeightDest, IntPtr hdcSrc, int nXOriginSrc, int nYOriginSrc, int nWidthSrc, int nHeightSrc, uint dwRop);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
}
"@

$sw = [GDI]::GetSystemMetrics(0)
$sh = [GDI]::GetSystemMetrics(1)
$hdc = [GDI]::GetDC([IntPtr]::Zero)
$startTime = Get-Date

# List of common ROP codes
# SRCCOPY = 0x00CC0020
# PATINVERT = 0x005A0049
# DSTINVERT = 0x00550009
# SRCINVERT = 0x00660046
# SRCAND = 0x008800C6

while ((Get-Date) -lt $startTime.AddSeconds(60)) {
    $effect = Get-Random -Minimum 0 -Maximum 6
    
    switch ($effect) {
        0 { # Screen Melting / Shuffling
            $x = Get-Random -Min -10 -Max 11
            $y = Get-Random -Min 1 -Max 10
            [GDI]::BitBlt($hdc, $x, $y, $sw, $sh, $hdc, 0, 0, 0x00CC0020)
        }
        1 { # Random Block Inversion
            $rect = New-Object GDI+RECT
            $rect.Left = Get-Random -Min 0 -Max $sw
            $rect.Top = Get-Random -Min 0 -Max $sh
            $rect.Right = $rect.Left + (Get-Random -Min 100 -Max 600)
            $rect.Bottom = $rect.Top + (Get-Random -Min 100 -Max 600)
            [GDI]::InvertRect($hdc, [ref]$rect)
        }
        2 { # PatBlt Chaos
            $brush = [GDI]::CreateSolidBrush((Get-Random -Min 0 -Max 0xFFFFFF))
            [GDI]::PatBlt($hdc, (Get-Random -Min 0 -Max $sw), (Get-Random -Min 0 -Max $sh), (Get-Random -Min 50 -Max 300), (Get-Random -Min 50 -Max 300), 0x005A0049)
        }
        3 { # Glitchy Copy
            $x1 = Get-Random -Min 0 -Max $sw
            $y1 = Get-Random -Min 0 -Max $sh
            $x2 = Get-Random -Min 0 -Max $sw
            $y2 = Get-Random -Min 0 -Max $sh
            $w = Get-Random -Min 50 -Max 400
            $h = Get-Random -Min 50 -Max 400
            [GDI]::BitBlt($hdc, $x1, $y1, $w, $h, $hdc, $x2, $y2, 0x00CC0020)
        }
        4 { # Full Screen Invert
            if ((Get-Random -Min 0 -Max 20) -eq 0) {
                [GDI]::PatBlt($hdc, 0, 0, $sw, $sh, 0x00550009)
            }
        }
        5 { # Stretch Distortion
            $x = Get-Random -Min 0 -Max $sw
            $y = Get-Random -Min 0 -Max $sh
            $w = Get-Random -Min 100 -Max 500
            $h = Get-Random -Min 100 -Max 500
            [GDI]::StretchBlt($hdc, $x + (Get-Random -Min -10 -Max 10), $y + (Get-Random -Min -10 -Max 10), $w, $h, $hdc, $x, $y, $w, $h, 0x00CC0020)
        }
    }
    
    # Random sound effect (Beep)
    if ((Get-Random -Min 0 -Max 15) -eq 0) {
        $freq = Get-Random -Min 100 -Max 2500
        $dur = Get-Random -Min 50 -Max 150
        [System.Console]::Beep($freq, $dur)
    }
    
    Start-Sleep -Milliseconds (Get-Random -Min 5 -Max 30)
}

[GDI]::ReleaseDC([IntPtr]::Zero, $hdc)
# Redraw screen to clear mess
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class User32 {
    [DllImport("user32.dll")]
    public static extern bool RedrawWindow(IntPtr hWnd, IntPtr lprcUpdate, IntPtr hrgnUpdate, uint flags);
}
"@
[User32]::RedrawWindow([IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, 0x0085) # RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN
