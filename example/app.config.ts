import 'ts-node/register'; // Add this to import TypeScript files
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
    "name": "expo-keyword-based-recognizer-example",
    "slug": "expo-keyword-based-recognizer-example",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "expo.modules.keywordbasedrecognizer.example",
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "package": "expo.modules.keywordbasedrecognizer.example"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
     "plugins":[ [
      "../app.plugin.js",
      { microphonePermission: "Mic please!",
        speechRecognitionPermission: "Speech please!",
      }
    ]
  ]
};

export default config;
