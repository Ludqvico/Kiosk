#include <windows.h>
#include <winuser.h>
#include <tlhelp32.h>
#include "input_blocker_win.h"

static bool isBlocking = false;
static HANDLE explorerProcessHandle = NULL;

// METODO AGGRESSIVO: USA BlockInput() DI WINDOWS
Napi::Value BlockInput(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (isBlocking) {
        return Napi::Boolean::New(env, false);
    }

    // 1. USA BlockInput() - BLOCCA TUTTO MOUSE E TASTIERA A LIVELLO DI SISTEMA
    BOOL blockResult = BlockInput(TRUE);

    if (!blockResult) {
        Napi::Error::New(env, "BlockInput fallito. DEVI eseguire come AMMINISTRATORE.")
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    // 2. KILLA EXPLORER.EXE per disabilitare taskbar, Alt+Tab, Win key
    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot != INVALID_HANDLE_VALUE) {
        PROCESSENTRY32 pe32;
        pe32.dwSize = sizeof(PROCESSENTRY32);

        if (Process32First(hSnapshot, &pe32)) {
            do {
                if (_wcsicmp(pe32.szExeFile, L"explorer.exe") == 0) {
                    HANDLE hProcess = OpenProcess(PROCESS_TERMINATE, FALSE, pe32.th32ProcessID);
                    if (hProcess) {
                        TerminateProcess(hProcess, 0);
                        CloseHandle(hProcess);
                    }
                }
            } while (Process32Next(hSnapshot, &pe32));
        }
        CloseHandle(hSnapshot);
    }

    // 3. DISABILITA TASK MANAGER via registro
    HKEY hKey;
    DWORD dwDisposition;
    if (RegCreateKeyEx(HKEY_CURRENT_USER,
                       TEXT("Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"),
                       0, NULL, 0, KEY_WRITE, NULL, &hKey, &dwDisposition) == ERROR_SUCCESS) {
        DWORD value = 1;
        RegSetValueEx(hKey, TEXT("DisableTaskMgr"), 0, REG_DWORD, (BYTE*)&value, sizeof(value));
        RegCloseKey(hKey);
    }

    // 4. NASCONDI CURSORE
    ShowCursor(FALSE);

    isBlocking = true;
    return Napi::Boolean::New(env, true);
}

Napi::Value UnblockInput(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!isBlocking) {
        return Napi::Boolean::New(env, false);
    }

    // 1. SBLOCCA INPUT
    BlockInput(FALSE);

    // 2. RIAVVIA EXPLORER.EXE
    STARTUPINFO si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    CreateProcess(TEXT("C:\\Windows\\explorer.exe"), NULL, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    // 3. RIABILITA TASK MANAGER
    HKEY hKey;
    if (RegOpenKeyEx(HKEY_CURRENT_USER,
                     TEXT("Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"),
                     0, KEY_WRITE, &hKey) == ERROR_SUCCESS) {
        RegDeleteValue(hKey, TEXT("DisableTaskMgr"));
        RegCloseKey(hKey);
    }

    // 4. MOSTRA CURSORE
    ShowCursor(TRUE);

    isBlocking = false;
    return Napi::Boolean::New(env, true);
}

Napi::Object InitWin(Napi::Env env, Napi::Object exports) {
    exports.Set("blockInput", Napi::Function::New(env, BlockInput));
    exports.Set("unblockInput", Napi::Function::New(env, UnblockInput));
    return exports;
}
