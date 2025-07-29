// Reexport the native module. On web, it will be resolved to ExpoKeywordBasedRecognizerModule.web.ts
// and on native platforms to ExpoKeywordBasedRecognizerModule.ts
import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
import { SpeechRecognitionManager } from './SpeechRecognitionManager';

// Export the singleton manager as the default export
export default SpeechRecognitionManager.getInstance();

// Export types
export * from './ExpoKeywordBasedRecognizer.types';
export * from './SpeechRecognitionTypes';
export { SpeechRecognitionManager } from './SpeechRecognitionManager';
export { SpeechRecognitionFlow } from './SpeechRecognitionFlow';

// Legacy exports for backward compatibility
export const ExpoKeywordBasedRecognizer = ExpoKeywordBasedRecognizerModule;
export const getAvailableLanguages = ExpoKeywordBasedRecognizerModule.getAvailableLanguages;
export const requestPermissionsAsync = ExpoKeywordBasedRecognizerModule.requestPermissionsAsync;
export const activate = ExpoKeywordBasedRecognizerModule.activate;
export const deactivate = ExpoKeywordBasedRecognizerModule.deactivate;
