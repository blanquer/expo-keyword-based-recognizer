import { NativeModule, requireNativeModule } from 'expo';

import { ExpoKeywordBasedRecognizerModuleEvents } from './ExpoKeywordBasedRecognizer.types';

declare class ExpoKeywordBasedRecognizerModule extends NativeModule<ExpoKeywordBasedRecognizerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoKeywordBasedRecognizerModule>('ExpoKeywordBasedRecognizer');
