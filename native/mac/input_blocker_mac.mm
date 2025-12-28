#import <ApplicationServices/ApplicationServices.h>
#import <Carbon/Carbon.h>
#import <Cocoa/Cocoa.h>
#include "input_blocker_mac.h"

static CFMachPortRef eventTap = NULL;
static CFRunLoopSourceRef runLoopSource = NULL;

// Callback che blocca tutti gli eventi di input
CGEventRef eventTapCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    // Blocca tutti gli eventi ritornando NULL
    // Questo impedisce che gli eventi vengano propagati al sistema

    // Eventi da bloccare:
    // - Tastiera (keyDown, keyUp)
    // - Mouse (movimento, click, scroll)
    // - Trackpad (gesture, swipe, pinch, ecc.)

    switch (type) {
        case kCGEventKeyDown:
        case kCGEventKeyUp:
        case kCGEventFlagsChanged:
        case kCGEventLeftMouseDown:
        case kCGEventLeftMouseUp:
        case kCGEventRightMouseDown:
        case kCGEventRightMouseUp:
        case kCGEventMouseMoved:
        case kCGEventLeftMouseDragged:
        case kCGEventRightMouseDragged:
        case kCGEventScrollWheel:
        case kCGEventTabletPointer:
        case kCGEventTabletProximity:
        case kCGEventOtherMouseDown:
        case kCGEventOtherMouseUp:
        case kCGEventOtherMouseDragged:
            // Blocca l'evento
            return NULL;

        case kCGEventTapDisabledByTimeout:
        case kCGEventTapDisabledByUserInput:
            // Riabilita il tap se viene disabilitato
            if (eventTap) {
                CGEventTapEnable(eventTap, true);
            }
            return event;

        default:
            return NULL;
    }
}

Napi::Value BlockInput(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (eventTap != NULL) {
        return Napi::Boolean::New(env, false); // Già bloccato
    }

    // Crea un event tap che intercetta tutti gli eventi
    CGEventMask eventMask =
        CGEventMaskBit(kCGEventKeyDown) |
        CGEventMaskBit(kCGEventKeyUp) |
        CGEventMaskBit(kCGEventFlagsChanged) |
        CGEventMaskBit(kCGEventLeftMouseDown) |
        CGEventMaskBit(kCGEventLeftMouseUp) |
        CGEventMaskBit(kCGEventRightMouseDown) |
        CGEventMaskBit(kCGEventRightMouseUp) |
        CGEventMaskBit(kCGEventMouseMoved) |
        CGEventMaskBit(kCGEventLeftMouseDragged) |
        CGEventMaskBit(kCGEventRightMouseDragged) |
        CGEventMaskBit(kCGEventScrollWheel) |
        CGEventMaskBit(kCGEventTabletPointer) |
        CGEventMaskBit(kCGEventTabletProximity) |
        CGEventMaskBit(kCGEventOtherMouseDown) |
        CGEventMaskBit(kCGEventOtherMouseUp) |
        CGEventMaskBit(kCGEventOtherMouseDragged);

    eventTap = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionDefault,
        eventMask,
        eventTapCallback,
        NULL
    );

    if (!eventTap) {
        Napi::Error::New(env, "Impossibile creare event tap. Assicurati che l'app abbia i permessi di Accessibilità.")
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
    CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, kCFRunLoopCommonModes);
    CGEventTapEnable(eventTap, true);

    // Nascondi il cursore
    [NSCursor hide];

    // Disabilita Force Quit (Cmd+Option+Esc)
    [[NSUserDefaults standardUserDefaults] setBool:YES forKey:@"NSDisabledCharacterPaletteMenuItem"];

    return Napi::Boolean::New(env, true);
}

Napi::Value UnblockInput(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (eventTap == NULL) {
        return Napi::Boolean::New(env, false); // Non era bloccato
    }

    CGEventTapEnable(eventTap, false);

    if (runLoopSource) {
        CFRunLoopRemoveSource(CFRunLoopGetCurrent(), runLoopSource, kCFRunLoopCommonModes);
        CFRelease(runLoopSource);
        runLoopSource = NULL;
    }

    if (eventTap) {
        CFRelease(eventTap);
        eventTap = NULL;
    }

    // Mostra il cursore
    [NSCursor unhide];

    // Riabilita Force Quit
    [[NSUserDefaults standardUserDefaults] setBool:NO forKey:@"NSDisabledCharacterPaletteMenuItem"];

    return Napi::Boolean::New(env, true);
}

Napi::Object InitMac(Napi::Env env, Napi::Object exports) {
    exports.Set("blockInput", Napi::Function::New(env, BlockInput));
    exports.Set("unblockInput", Napi::Function::New(env, UnblockInput));
    return exports;
}
