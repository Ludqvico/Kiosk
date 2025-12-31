@echo off
REM Lunaris Compilation Script for Windows
REM Run this script in the lunaris-main folder on Windows

echo ========================================
echo Lunaris to EXE Compiler
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Installing PyInstaller...
pip install pyinstaller
if errorlevel 1 (
    echo ERROR: Failed to install PyInstaller
    pause
    exit /b 1
)

echo.
echo [2/3] Compiling main.py to executable...
pyinstaller --onefile --noconsole --name solaris_extreme main.py
if errorlevel 1 (
    echo ERROR: Compilation failed
    pause
    exit /b 1
)

echo.
echo [3/3] Moving executable to bin folder...
if not exist "..\bin" mkdir "..\bin"
copy /Y "dist\solaris_extreme.exe" "..\bin\solaris_extreme.exe"
if errorlevel 1 (
    echo ERROR: Failed to copy executable
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! 
echo ========================================
echo Executable created: ..\bin\solaris_extreme.exe
echo.
echo You can now delete the build and dist folders if you want.
echo.
pause
