Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "C:\Kiosk\node_modules\.bin\electron.cmd" & chr(34) & " " & chr(34) & "C:\Kiosk\dist\main.js" & chr(34), 0
Set WshShell = Nothing
