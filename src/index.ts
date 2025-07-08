// Reexport the native module. On web, it will be resolved to ExpoKeywordBasedRecognizerModule.web.ts
// and on native platforms to ExpoKeywordBasedRecognizerModule.ts
export { default } from './ExpoKeywordBasedRecognizerModule';
export { default as ExpoKeywordBasedRecognizerView } from './ExpoKeywordBasedRecognizerView';
export * from  './ExpoKeywordBasedRecognizer.types';
