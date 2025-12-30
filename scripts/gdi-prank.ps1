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
    public static extern bool SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

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
$duration = 60

# Background Audio Thread (approximate drone)
$audioJob = Start-Job -ScriptBlock {
    $start = Get-Date
    while ((Get-Date) -lt $start.AddSeconds(60)) {
        $elapsed = ((Get-Date) - $start).TotalSeconds
        $intensity = $elapsed / 60
        
        # Base Drone (Low frequency)
        $freq = 40 + (10 * [Math]::Sin($elapsed))
        [System.Console]::Beep([int]$freq, 200)
        
        # Random Creepy Noises (frequency increases)
        if ((Get-Random -Min 0 -Max 100) -lt (10 + (40 * $intensity))) {
            $hFreq = Get-Random -Min 200 -Max (500 + (2000 * $intensity))
            [System.Console]::Beep([int]$hFreq, 50)
        }
        Start-Sleep -Milliseconds 10
    }
}

while (((Get-Date) - $startTime).TotalSeconds -lt $duration) {
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $intensity = $elapsed / $duration # 0.0 to 1.0
    
    $effect = Get-Random -Minimum 0 -Maximum 8
    
    switch ($effect) {
        0 { # Progressive Screen Melting
            $x = Get-Random -Min (-2 * $intensity) -Max (3 * $intensity)
            $y = Get-Random -Min 1 -Max (15 * $intensity + 1)
            [GDI]::BitBlt($hdc, [int]$x, [int]$y, $sw, $sh, $hdc, 0, 0, 0x00CC0020)
        }
        1 { # Red Ghosting / Blur (StretchBlt)
            $offset = (Get-Random -Min 1 -Max (5 * $intensity + 2))
            [GDI]::StretchBlt($hdc, $offset, $offset, $sw - ($offset*2), $sh - ($offset*2), $hdc, 0, 0, $sw, $sh, 0x00CC0020)
        }
        2 { # PatBlt Crimson Chaos
            # Color shifts more towards pure red as intensity grows
            $r = 50 + (205 * $intensity)
            $g = 50 * (1 - $intensity)
            $b = 50 * (1 - $intensity)
            $color = ([int]$r) + ([int]$g -shl 8) + ([int]$b -shl 16)
            
            $brush = [GDI]::CreateSolidBrush($color)
            [GDI]::SelectObject($hdc, $brush)
            [GDI]::PatBlt($hdc, (Get-Random -Min 0 -Max $sw), (Get-Random -Min 0 -Max $sh), (Get-Random -Min 100 -Max 400), (Get-Random -Min 100 -Max 400), 0x005A0049) # PATINVERT
            [GDI]::DeleteObject($brush)
        }
        3 { # Glitchy Block Displacement
            $w = Get-Random -Min 100 -Max (300 + 400 * $intensity)
            $h = Get-Random -Min 100 -Max (300 + 400 * $intensity)
            $x1 = Get-Random -Min 0 -Max ($sw - $w)
            $y1 = Get-Random -Min 0 -Max ($sh - $h)
            $x2 = $x1 + (Get-Random -Min -20 -Max 21) * $intensity
            $y2 = $y1 + (Get-Random -Min -20 -Max 21) * $intensity
            [GDI]::BitBlt($hdc, [int]$x1, [int]$y1, [int]$w, [int]$h, $hdc, [int]$x2, [int]$y2, 0x00CC0020)
        }
        4 { # High Contrast Negative Flashes
            if ((Get-Random -Min 0 -Max 100) -lt (5 * $intensity)) {
                [GDI]::PatBlt($hdc, 0, 0, $sw, $sh, 0x00550009) # DSTINVERT
            }
        }
        5 { # Shivering Screen
            $shiver = (Get-Random -Min -2 -Max 3) * $intensity
            [GDI]::BitBlt($hdc, [int]$shiver, [int]$shiver, $sw, $sh, $hdc, 0, 0, 0x00CC0020)
        }
        6 { # Random Rect Inversion (creepy boxes)
            $rect = New-Object GDI+RECT
            $rect.Left = Get-Random -Min 0 -Max $sw
            $rect.Top = Get-Random -Min 0 -Max $sh
            $rect.Right = $rect.Left + (Get-Random -Min 50 -Max (200 + 300 * $intensity))
            $rect.Bottom = $rect.Top + (Get-Random -Min 50 -Max (200 + 300 * $intensity))
            [GDI]::InvertRect($hdc, [ref]$rect)
        }
        7 { # Diagonal Slice Displacement
             [GDI]::BitBlt($hdc, (Get-Random -Min -10 -Max 10), (Get-Random -Min -10 -Max 10), $sw, $sh, $hdc, 0, 0, 0x00EE0086) # SRCPAINT
        }
    }
    
    $sleep = 30 - (25 * $intensity)
    if ($sleep -lt 1) { $sleep = 1 }
    Start-Sleep -Milliseconds [int]$sleep
}

[GDI]::ReleaseDC([IntPtr]::Zero, $hdc)
Stop-Job $audioJob
Remove-Job $audioJob

# Final Redraw to clean up
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class User32 {
    [DllImport("user32.dll")]
    public static extern bool RedrawWindow(IntPtr hWnd, IntPtr lprcUpdate, IntPtr hrgnUpdate, uint flags);
}
"@
[User32]::RedrawWindow([IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, 0x0085)
