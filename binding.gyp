{
  "targets": [
    {
      "target_name": "inputblocker",
      "sources": [
        "native/addon.cc"
      ],
      "conditions": [
        [
          "OS=='mac'",
          {
            "sources": [
              "native/mac/input_blocker_mac.mm"
            ],
            "xcode_settings": {
              "OTHER_CFLAGS": [
                "-x objective-c++ -stdlib=libc++"
              ]
            },
            "link_settings": {
              "libraries": [
                "-framework ApplicationServices",
                "-framework Carbon",
                "-framework Cocoa"
              ]
            }
          }
        ],
        [
          "OS=='win'",
          {
            "sources": [
              "native/win/input_blocker_win.cc"
            ],
            "libraries": [
              "user32.lib"
            ]
          }
        ]
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
    }
  ]
}
