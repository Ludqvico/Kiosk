#ifndef INPUT_BLOCKER_WIN_H
#define INPUT_BLOCKER_WIN_H

#include <napi.h>

Napi::Object InitWin(Napi::Env env, Napi::Object exports);
Napi::Value BlockInput(const Napi::CallbackInfo& info);
Napi::Value UnblockInput(const Napi::CallbackInfo& info);

#endif
