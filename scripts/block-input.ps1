# Block all input using Windows BlockInput API
# Requires Administrator privileges
param([switch]$Unblock)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class InputBlocker {
    [DllImport("user32.dll")]
    public static extern bool BlockInput(bool fBlockIt);
}
"@

if ($Unblock) {
    [InputBlocker]::BlockInput($false)
    Write-Host "Input unblocked"
} else {
    [InputBlocker]::BlockInput($true)
    Write-Host "Input blocked"
    # Keep the script running to maintain the block
    while ($true) { Start-Sleep -Seconds 1 }
}
