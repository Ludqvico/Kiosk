#ifndef INPUT_BLOCKER_MAC_H
#define INPUT_BLOCKER_MAC_H

#include <napi.h>

Napi::Object InitMac(Napi::Env env, Napi::Object exports);
Napi::Value BlockInput(const Napi::CallbackInfo& info);
Napi::Value UnblockInput(const Napi::CallbackInfo& info);

#endif
