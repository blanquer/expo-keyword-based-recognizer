import { NativeModule } from 'expo';
import { ExpoKeywordBasedRecognizerModuleEvents, KeywordRecognizerOptions, Language, PermissionResponse } from './ExpoKeywordBasedRecognizer.types';
declare class ExpoKeywordBasedRecognizerModule extends NativeModule<ExpoKeywordBasedRecognizerModuleEvents> {
    activate(options: KeywordRecognizerOptions): Promise<void>;
    deactivate(): Promise<void>;
    requestPermissionsAsync(): Promise<PermissionResponse>;
    getAvailableLanguages(): Promise<Language[]>;
}
declare const _default: ExpoKeywordBasedRecognizerModule;
export default _default;
//# sourceMappingURL=ExpoKeywordBasedRecognizerModule.d.ts.map