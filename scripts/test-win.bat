@echo off
REM Script di test per Windows
REM Verifica che tutti i requisiti siano soddisfatti

echo === Test ambiente Windows ===
echo.

REM Verifica Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo [OK] Node.js installato: %NODE_VERSION%
) else (
    echo [ERRORE] Node.js NON installato
    exit /b 1
)

REM Verifica npm
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
    echo [OK] npm installato: %NPM_VERSION%
) else (
    echo [ERRORE] npm NON installato
    exit /b 1
)

REM Verifica Visual Studio Build Tools
where cl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Visual Studio Build Tools trovato
) else (
    echo [ATTENZIONE] Visual Studio Build Tools potrebbe non essere installato
    echo   Scarica da: https://visualstudio.microsoft.com/downloads/
)

echo.
echo === Test compilazione addon nativi ===
call npm run rebuild

if exist "build\Release\inputblocker.node" (
    echo [OK] Addon nativo compilato correttamente
) else (
    echo [ERRORE] Errore nella compilazione dell'addon nativo
    exit /b 1
)

echo.
echo === Test compilazione TypeScript ===
call npm run build

if exist "dist" (
    echo [OK] TypeScript compilato correttamente
) else (
    echo [ERRORE] Errore nella compilazione TypeScript
    exit /b 1
)

echo.
echo === Tutti i test superati! ===
echo.
echo Puoi avviare l'app con: npm start
echo.
echo IMPORTANTE: Per il blocco completo, esegui come amministratore!
pause
