# Avvia il client kiosk SENZA console (Windows)
# Questo script nasconde completamente la finestra console

$electronPath = "C:\Kiosk\node_modules\.bin\electron.cmd"
$mainPath = "C:\Kiosk\dist\main.js"

# Crea processo nascosto
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $electronPath
$psi.Arguments = $mainPath
$psi.WindowStyle = "Hidden"
$psi.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($psi)

Write-Host "Client kiosk avviato in background (PID: $($process.Id))"
Write-Host "Per terminare: Stop-Process -Id $($process.Id) -Force"
