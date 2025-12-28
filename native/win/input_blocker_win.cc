#include <windows.h>
#include <winuser.h>
#include "input_blocker_win.h"

static HHOOK keyboardHook = NULL;
static HHOOK mouseHook = NULL;
static bool isBlocking = false;

// Hook per bloccare la tastiera
LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && isBlocking) {
        KBDLLHOOKSTRUCT* pKeyboard = (KBDLLHOOKSTRUCT*)lParam;

        // Blocca tutte le combinazioni pericolose
        bool ctrlPressed = GetAsyncKeyState(VK_CONTROL) & 0x8000;
        bool altPressed = GetAsyncKeyState(VK_MENU) & 0x8000;
        bool winPressed = GetAsyncKeyState(VK_LWIN) & 0x8000 || GetAsyncKeyState(VK_RWIN) & 0x8000;
        bool shiftPressed = GetAsyncKeyState(VK_SHIFT) & 0x8000;

        // Blocca Ctrl+Alt+Del (non direttamente bloccabile, ma possiamo bloccare i singoli tasti)
        // Blocca Alt+F4
        if (altPressed && pKeyboard->vkCode == VK_F4) {
            return 1; // Blocca
        }

        // Blocca Alt+Tab
        if (altPressed && pKeyboard->vkCode == VK_TAB) {
            return 1;
        }

        // Blocca Ctrl+Esc (Start menu)
        if (ctrlPressed && pKeyboard->vkCode == VK_ESCAPE) {
            return 1;
        }

        // Blocca Win key
        if (pKeyboard->vkCode == VK_LWIN || pKeyboard->vkCode == VK_RWIN) {
            return 1;
        }

        // Blocca Win+D, Win+E, Win+L, ecc.
        if (winPressed) {
            return 1;
        }

        // Blocca Ctrl+Shift+Esc (Task Manager)
        if (ctrlPressed && shiftPressed && pKeyboard->vkCode == VK_ESCAPE) {
            return 1;
        }

        // Blocca F1-F12 (help, refresh, ecc.)
        if (pKeyboard->vkCode >= VK_F1 && pKeyboard->vkCode <= VK_F12) {
            return 1;
        }

        // BLOCCA TUTTO L'INPUT TASTIERA
        return 1;
    }

    return CallNextHookEx(keyboardHook, nCode, wParam, lParam);
}

// Hook per bloccare il mouse
LRESULT CALLBACK LowLevelMouseProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && isBlocking) {
        // BLOCCA TUTTI GLI EVENTI DEL MOUSE (movimento, click, scroll, tutto)
        return 1;
    }

    return CallNextHookEx(mouseHook, nCode, wParam, lParam);
}

Napi::Value BlockInput(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (isBlocking) {
        return Napi::Boolean::New(env, false); // Già bloccato
    }

    // Installa gli hook
    keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, GetModuleHandle(NULL), 0);
    mouseHook = SetWindowsHookEx(WH_MOUSE_LL, LowLevelMouseProc, GetModuleHandle(NULL), 0);

    if (!keyboardHook || !mouseHook) {
        if (keyboardHook) UnhookWindowsHookEx(keyboardHook);
        if (mouseHook) UnhookWindowsHookEx(mouseHook);

        Napi::Error::New(env, "Impossibile installare gli hook. L'app deve essere eseguita come amministratore.")
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    isBlocking = true;

    // Nascondi il cursore (opzionale)
    ShowCursor(FALSE);

    // Disabilita Task Manager tramite registro (richiede privilegi amministratore)
    HKEY hKey;
    DWORD dwDisposition;
    if (RegCreateKeyEx(HKEY_CURRENT_USER,
                       TEXT("Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"),
                       0, NULL, 0, KEY_WRITE, NULL, &hKey, &dwDisposition) == ERROR_SUCCESS) {
        DWORD value = 1;
        RegSetValueEx(hKey, TEXT("DisableTaskMgr"), 0, REG_DWORD, (BYTE*)&value, sizeof(value));
        RegCloseKey(hKey);
    }

    return Napi::Boolean::New(env, true);
}

Napi::Value UnblockInput(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!isBlocking) {
        return Napi::Boolean::New(env, false); // Non era bloccato
    }

    // Rimuovi gli hook
    if (keyboardHook) {
        UnhookWindowsHookEx(keyboardHook);
        keyboardHook = NULL;
    }

    if (mouseHook) {
        UnhookWindowsHookEx(mouseHook);
        mouseHook = NULL;
    }

    isBlocking = false;

    // Mostra il cursore
    ShowCursor(TRUE);

    // Riabilita Task Manager
    HKEY hKey;
    if (RegOpenKeyEx(HKEY_CURRENT_USER,
                     TEXT("Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"),
                     0, KEY_WRITE, &hKey) == ERROR_SUCCESS) {
        RegDeleteValue(hKey, TEXT("DisableTaskMgr"));
        RegCloseKey(hKey);
    }

    return Napi::Boolean::New(env, true);
}

Napi::Object InitWin(Napi::Env env, Napi::Object exports) {
    exports.Set("blockInput", Napi::Function::New(env, BlockInput));
    exports.Set("unblockInput", Napi::Function::New(env, UnblockInput));
    return exports;
}
