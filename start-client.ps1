# Avvia il client kiosk SENZA console (Windows)
# Nasconde solo la console, l'app Electron resta visibile

$electronExe = "C:\Kiosk\node_modules\electron\dist\electron.exe"
$mainPath = "C:\Kiosk"

# Avvia Electron direttamente (non tramite .cmd) come amministratore
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $electronExe
$psi.Arguments = "`"$mainPath`""
$psi.WorkingDirectory = $mainPath
$psi.Verb = "runas"  # Esegui come amministratore
$psi.UseShellExecute = $true

$process = [System.Diagnostics.Process]::Start($psi)

Write-Host "Client kiosk avviato come AMMINISTRATORE"
Write-Host "Controlla la dashboard per vedere la connessione"
