// Reexport the native module. On web, it will be resolved to ExpoKeywordBasedRecognizerModule.web.ts
// and on native platforms to ExpoKeywordBasedRecognizerModule.ts
import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
export default ExpoKeywordBasedRecognizerModule;
export * from './ExpoKeywordBasedRecognizer.types';
// Export module methods for easier access
export const getAvailableLanguages = ExpoKeywordBasedRecognizerModule.getAvailableLanguages;
export const requestPermissionsAsync = ExpoKeywordBasedRecognizerModule.requestPermissionsAsync;
export const activate = ExpoKeywordBasedRecognizerModule.activate;
export const deactivate = ExpoKeywordBasedRecognizerModule.deactivate;
//# sourceMappingURL=index.js.map