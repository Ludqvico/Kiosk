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

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateEllipticRgn(int nLeftRect, int nTopRect, int nRightRect, int nBottomRect);

    [DllImport("user32.dll")]
    public static extern int SelectClipRgn(IntPtr hdc, IntPtr hrgn);

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
    public static extern bool RedrawWindow(IntPtr hWnd, IntPtr lprcUpdate, IntPtr hrgnUpdate, uint flags);
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

# Background "Drone" & "Creepy" Audio Thread
$audioJob = Start-Job -ScriptBlock {
    $start = Get-Date
    while ((Get-Date) -lt $start.AddSeconds(60)) {
        $elapsed = ((Get-Date) - $start).TotalSeconds
        $intensity = $elapsed / 60
        
        # Solaris-like Drone (Low pulsating)
        $freq = 40 + [Math]::Floor(10 * [Math]::Sin($elapsed * 3))
        [System.Console]::Beep([int]$freq, 250)
        
        # High Intensity Screams
        if ((Get-Random -Min 0 -Max 100) -lt (5 + 45 * $intensity)) {
            $hFreq = Get-Random -Min 500 -Max (1000 + 4000 * $intensity)
            [System.Console]::Beep([int]$hFreq, 40)
        }
        
        if ((Get-Random -Min 0 -Max 200) -lt (1 + 15 * $intensity)) {
             [System.Console]::Beep(100, 400) # Deep crash
        }
        
        Start-Sleep -Milliseconds 5
    }
}

while (((Get-Date) - $startTime).TotalSeconds -lt $duration) {
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $intensity = $elapsed / $duration
    
    $effect = Get-Random -Minimum 0 -Maximum 10
    
    switch ($effect) {
        0 { # Solaris: PlgBlt Skew (Dizzy)
            $side = Get-Random -Min 0 -Max 2
            $pts = New-Object GDI+POINT[] 3
            $mod = [int](10 + 20 * $intensity)
            if ($side -eq 0) {
                $pts[0] = New-Object GDI+POINT($mod, -$mod)
                $pts[1] = New-Object GDI+POINT($sw + $mod, $mod)
                $pts[2] = New-Object GDI+POINT(-$mod, $sh - $mod)
            } else {
                $pts[0] = New-Object GDI+POINT(-$mod, $mod)
                $pts[1] = New-Object GDI+POINT($sw - $mod, -$mod)
                $pts[2] = New-Object GDI+POINT($mod, $sh + $mod)
            }
            [GDI]::PlgBlt($hdc, $pts, $hdc, 0, 0, $sw, $sh, [IntPtr]::Zero, 0, 0)
        }
        1 { # Solaris: Cubes (Inward/Outward Stretch)
            $mod = [int](15 + 35 * $intensity)
            if ((Get-Random -Min 0 -Max 2) -eq 0) {
                [GDI]::StretchBlt($hdc, $mod, $mod, $sw - ($mod*2), $sh - ($mod*2), $hdc, 0, 0, $sw, $sh, 0x00CC0020)
            } else {
                [GDI]::StretchBlt($hdc, -$mod, -$mod, $sw + ($mod*2), $sh + ($mod*2), $hdc, 0, 0, $sw, $sh, 0x00CC0020)
            }
        }
        2 { # Solaris: CircleInvert (Elliptic Regions)
            $size = Get-Random -Min 100 -Max [int](300 + 500 * $intensity)
            $x = Get-Random -Min 0 -Max ($sw - $size)
            $y = Get-Random -Min 0 -Max ($sh - $size)
            $hrgn = [GDI]::CreateEllipticRgn($x, $y, $x + $size, $y + $size)
            [GDI]::SelectClipRgn($hdc, $hrgn)
            [GDI]::BitBlt($hdc, $x, $y, $size, $size, $hdc, $x, $y, 0x00550009) # DSTINVERT style
            [GDI]::SelectClipRgn($hdc, [IntPtr]::Zero)
            [GDI]::DeleteObject($hrgn)
        }
        3 { # Solaris: Shake (Sin/Cos Displacement)
            $offset = [int](10 * [Math]::Sin($elapsed * 5) * $intensity)
            [GDI]::BitBlt($hdc, $offset, $offset, $sw, $sh, $hdc, 0, 0, 0x00CC0020)
        }
        4 { # Solaris: Stripes (Dun/Dun2 Style)
            $h = Get-Random -Min 5 -Max [int](20 + 200 * $intensity)
            $y = Get-Random -Min 0 -Max ($sh - $h)
            $r = [int](50 + 200 * $intensity)
            $color = $r + (0 -shl 8) + (0 -shl 16) # Blood Red
            $brush = [GDI]::CreateSolidBrush($color)
            [GDI]::SelectObject($hdc, $brush)
            [GDI]::PatBlt($hdc, 0, $y, $sw, $h, 0x005A0049) # PATINVERT
            [GDI]::DeleteObject($brush)
        }
        5 { # Negative Glitch Flashes
            if ((Get-Random -Min 0 -Max 100) -lt (8 * $intensity + 1)) {
                [GDI]::PatBlt($hdc, 0, 0, $sw, $sh, 0x00550009) # DSTINVERT
            }
        }
        6 { # Block Glitch (Solaris h1/h2 style)
            $w = Get-Random -Min 100 -Max 400
            $h = Get-Random -Min 100 -Max 400
            $x = Get-Random -Min 0 -Max ($sw - $w)
            $y = Get-Random -Min 0 -Max ($sh - $h)
            $off = [int]((Get-Random -Min -30 -Max 31) * $intensity)
            [GDI]::BitBlt($hdc, $x, $y, $w, $h, $hdc, $x + $off, $y + $off, 0x00CC0020)
        }
        7 { # Diagonal Slice Leak
             [GDI]::BitBlt($hdc, (Get-Random -Min -30 -Max 30), (Get-Random -Min -30 -Max 30), $sw, $sh, $hdc, 0, 0, 0x00EE0086)
        }
        8 { # Random Squared Inversions
            $rect = New-Object GDI+RECT
            $size = Get-Random -Min 50 -Max 300
            $rect.Left = Get-Random -Min 0 -Max ($sw - $size)
            $rect.Top = Get-Random -Min 0 -Max ($sh - $size)
            $rect.Right = $rect.Left + $size
            $rect.Bottom = $rect.Top + $size
            [GDI]::InvertRect($hdc, [ref]$rect)
        }
        9 { # RGB Melting (Continuous vertical shift)
             $x = Get-Random -Min -5 -Max 6
             $y = [int](5 + 15 * $intensity)
             [GDI]::BitBlt($hdc, $x, $y, $sw, $sh, $hdc, 0, 0, 0x00CC0020)
        }
    }
    
    $sleep = [int](35 - (30 * $intensity))
    if ($sleep -lt 2) { $sleep = 2 }
    Start-Sleep -Milliseconds $sleep
}

[GDI]::ReleaseDC([IntPtr]::Zero, $hdc)
Stop-Job $audioJob
Remove-Job $audioJob

# Final Restoration: Repeated Redraw to clear GDI artifacts
for($i=0; $i -lt 8; $i++) {
    [GDI]::RedrawWindow([IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, 0x85)
    Start-Sleep -Milliseconds 150
}
