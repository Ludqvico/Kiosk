#include <napi.h>

#ifdef __APPLE__
  #include "mac/input_blocker_mac.h"
#elif _WIN32
  #include "win/input_blocker_win.h"
#endif

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
#ifdef __APPLE__
  return InitMac(env, exports);
#elif _WIN32
  return InitWin(env, exports);
#else
  return exports;
#endif
}

NODE_API_MODULE(inputblocker, InitAll)
