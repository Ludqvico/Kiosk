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

    [DllImport("gdi32.dll")]
    public static extern bool PlgBlt(IntPtr hdcDest, POINT[] lpPoint, IntPtr hdcSrc, int nXSrc, int nYSrc, int nWidth, int nHeight, IntPtr hbmMask, int xMask, int yMask);

    [DllImport("gdi32.dll")]
    public static extern bool SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int x, y;
        public POINT(int x, int y) { this.x = x; this.y = y; }
    }

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
    
    [DllImport("user32.dll")]
    public static extern bool InvalidateRect(IntPtr hWnd, IntPtr lpRect, bool bErase);
}
"@

# Helper to set volume to 100%
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class AudioHelper {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    public static void VolumeUp() {
        for(int i=0; i<50; i++) keybd_event(0xAF, 0, 0, 0); // VK_VOLUME_UP
    }
}
"@
[AudioHelper]::VolumeUp()

$sw = [GDI]::GetSystemMetrics(0)
$sh = [GDI]::GetSystemMetrics(1)
$hdc = [GDI]::GetDC([IntPtr]::Zero)
$startTime = Get-Date
$duration = 60

# Background "Drone" & "Creepy" Audio
$audioJob = Start-Job -ScriptBlock {
    $start = Get-Date
    while ((Get-Date) -lt $start.AddSeconds(60)) {
        $elapsed = ((Get-Date) - $start).TotalSeconds
        $intensity = $elapsed / 60
        
        # Drone (Deep & Pulsing)
        $freq = 35 + [Math]::Floor(5 * [Math]::Sin($elapsed * 2))
        [System.Console]::Beep([int]$freq, 300)
        
        # Random High-Pitched Errors (Creepy)
        if ((Get-Random -Min 0 -Max 100) -lt (5 + 35 * $intensity)) {
            $hFreq = Get-Random -Min 1000 -Max (1200 + 4000 * $intensity)
            [System.Console]::Beep([int]$hFreq, 30)
        }
        
        # Random "Drone Collapse" Sound
        if ((Get-Random -Min 0 -Max 200) -lt (1 + 10 * $intensity)) {
             [System.Console]::Beep(100, 500)
        }
        
        Start-Sleep -Milliseconds 5
    }
}

while (((Get-Date) - $startTime).TotalSeconds -lt $duration) {
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $intensity = $elapsed / $duration
    
    $effect = Get-Random -Minimum 0 -Maximum 9
    
    switch ($effect) {
        0 { # Solaris: PlgBlt Skewing (Dizzy)
            $side = Get-Random -Min 0 -Max 2
            $pts = New-Object GDI+POINT[] 3
            if ($side -eq 0) { # Skew Left
                $pts[0] = New-Object GDI+POINT(10, -10)
                $pts[1] = New-Object GDI+POINT($sw + 10, 10)
                $pts[2] = New-Object GDI+POINT(-10, $sh - 10)
            } else { # Skew Right
                $pts[0] = New-Object GDI+POINT(-10, 10)
                $pts[1] = New-Object GDI+POINT($sw - 10, -10)
                $pts[2] = New-Object GDI+POINT(10, $sh + 10)
            }
            [GDI]::PlgBlt($hdc, $pts, $hdc, 0, 0, $sw, $sh, [IntPtr]::Zero, 0, 0)
        }
        1 { # Solaris: Cubes (Inward/Outward Stretch)
            $mod = [int](10 + 20 * $intensity)
            if ((Get-Random -Min 0 -Max 2) -eq 0) {
                [GDI]::StretchBlt($hdc, $mod, $mod, $sw - ($mod*2), $sh - ($mod*2), $hdc, 0, 0, $sw, $sh, 0x00CC0020)
            } else {
                [GDI]::StretchBlt($hdc, -$mod, -$mod, $sw + ($mod*2), $sh + ($mod*2), $hdc, 0, 0, $sw, $sh, 0x00CC0020)
            }
        }
        2 { # Progressive Crimson Bleeding
            $r = [int](80 + 175 * $intensity)
            $g = [int](20 * (1 - $intensity))
            $b = [int](20 * (1 - $intensity))
            $color = $r + ($g -shl 8) + ($b -shl 16)
            $brush = [GDI]::CreateSolidBrush($color)
            [GDI]::SelectObject($hdc, $brush)
            # Solaris-style stripe PatBlt
            $h = Get-Random -Min 10 -Max [int](50 + 400 * $intensity)
            $y = Get-Random -Min 0 -Max ($sh - $h)
            [GDI]::PatBlt($hdc, 0, $y, $sw, $h, 0x005A0049) # PATINVERT
            [GDI]::DeleteObject($brush)
        }
        3 { # Block Displacement (Glitch)
            $w = Get-Random -Min 150 -Max [int](300 + 600 * $intensity)
            $h = Get-Random -Min 150 -Max [int](300 + 600 * $intensity)
            $x1 = Get-Random -Min 0 -Max ($sw - $w)
            $y1 = Get-Random -Min 0 -Max ($sh - $h)
            $x2 = $x1 + (Get-Random -Min -30 -Max 31) * $intensity
            $y2 = $y1 + (Get-Random -Min -30 -Max 31) * $intensity
            [GDI]::BitBlt($hdc, [int]$x1, [int]$y1, [int]$w, [int]$h, $hdc, [int]$x2, [int]$y2, 0x00CC0020)
        }
        4 { # Negative Flashes (High Intensity)
            if ((Get-Random -Min 0 -Max 100) -lt (10 * $intensity + 2)) {
                [GDI]::PatBlt($hdc, 0, 0, $sw, $sh, 0x00550009) # DSTINVERT
            }
        }
        5 { # Shivering Chaos
            $shiver = [int]((Get-Random -Min -5 -Max 6) * $intensity)
            [GDI]::BitBlt($hdc, $shiver, $shiver, $sw, $sh, $hdc, 0, 0, 0x00CC0020)
        }
        6 { # Solaris: Squares (Random Inverting Blocks)
            $size = Get-Random -Min 50 -Max [int](200 + 400 * $intensity)
            $rect = New-Object GDI+RECT
            $rect.Left = Get-Random -Min 0 -Max ($sw - $size)
            $rect.Top = Get-Random -Min 0 -Max ($sh - $size)
            $rect.Right = $rect.Left + $size
            $rect.Bottom = $rect.Top + $size
            [GDI]::InvertRect($hdc, [ref]$rect)
        }
        7 { # Diagonal Color Leak
             [GDI]::BitBlt($hdc, (Get-Random -Min -20 -Max 20), (Get-Random -Min -20 -Max 20), $sw, $sh, $hdc, 0, 0, 0x00EE0086) # SRCPAINT
        }
        8 { # Solaris: RGB Melting (BitBlt Shift)
             $x = Get-Random -Min -10 -Max 11
             $y = Get-Random -Min 1 -Max [int](20 * $intensity + 5)
             [GDI]::BitBlt($hdc, $x, $y, $sw, $sh, $hdc, 0, 0, 0x00CC0020)
        }
    }
    
    $sleep = [int](25 - (20 * $intensity))
    if ($sleep -lt 1) { $sleep = 1 }
    Start-Sleep -Milliseconds $sleep
}

[GDI]::ReleaseDC([IntPtr]::Zero, $hdc)
Stop-Job $audioJob
Remove-Job $audioJob

# Final Cleanup: Forces redraw multiple times to ensure everything is back to normal
for($i=0; $i -lt 5; $i++) {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class User32Final {
        [DllImport("user32.dll")]
        public static extern bool RedrawWindow(IntPtr hWnd, IntPtr lprcUpdate, IntPtr hrgnUpdate, uint flags);
    }
"@
    [User32Final]::RedrawWindow([IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, 0x85)
    Start-Sleep -Milliseconds 100
}
