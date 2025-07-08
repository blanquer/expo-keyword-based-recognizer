import { registerWebModule, NativeModule } from 'expo';

import { ExpoKeywordBasedRecognizerModuleEvents } from './ExpoKeywordBasedRecognizer.types';

class ExpoKeywordBasedRecognizerModule extends NativeModule<ExpoKeywordBasedRecognizerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoKeywordBasedRecognizerModule, 'ExpoKeywordBasedRecognizerModule');
