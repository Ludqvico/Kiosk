# Compiling Lunaris to Windows Executable

## Quick Start (Windows)

1. Open Command Prompt or PowerShell in the `lunaris-main` folder
2. Run: `compile.bat`
3. The executable will be created in `../bin/solaris_extreme.exe`

## Manual Compilation (if script fails)

### Step 1: Install PyInstaller
```bash
pip install pyinstaller
```

### Step 2: Compile to EXE
```bash
pyinstaller --onefile --noconsole --name solaris_extreme main.py
```

### Step 3: Move the executable
```bash
copy dist\solaris_extreme.exe ..\bin\solaris_extreme.exe
```

## Compilation Options Explained

- `--onefile`: Creates a single executable file (no dependencies)
- `--noconsole`: Runs without showing a console window (GUI mode)
- `--name solaris_extreme`: Names the output file `solaris_extreme.exe`

## Troubleshooting

### "Python not found"
- Install Python from https://www.python.org/downloads/
- Make sure to check "Add Python to PATH" during installation

### "PyInstaller not found"
- Run: `pip install pyinstaller`
- Or: `python -m pip install pyinstaller`

### Executable doesn't work
- Make sure you're compiling on Windows (PyInstaller cannot cross-compile)
- Check that all dependencies are included (they should be with `--onefile`)

## After Compilation

The executable `solaris_extreme.exe` will be placed in the `bin` folder and will be automatically used by Kiosk when the "GDI Extreme" mode is selected.
