
import { ConfigPlugin } from 'expo/config-plugins';


const withExpoKeywordBasedRecognizer: ConfigPlugin<{
 microphonePermission?: string;
 speechRecognitionPermission?: string;
 }|undefined> = (config, props) => {
  // console.log("withExpoKeywordBasedRecognizer called with props:", props);
  if (!config.ios) {
    config.ios = {};
  }

  if (!config.ios.infoPlist) {
    config.ios.infoPlist = {};
  }

  config.ios.infoPlist.NSSpeechRecognitionUsageDescription =
    props?.speechRecognitionPermission ||
    config.ios.infoPlist.NSSpeechRecognitionUsageDescription ||
    "This app uses speech recognition to respond to voice commands after detecting the wake word.";

  config.ios.infoPlist.NSMicrophoneUsageDescription =
    props?.microphonePermission ||
    config.ios.infoPlist.NSMicrophoneUsageDescription ||
    "This app uses the microphone to listen for wake words and voice commands.";

  return config;
};

export default withExpoKeywordBasedRecognizer