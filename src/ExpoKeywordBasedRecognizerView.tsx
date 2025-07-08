import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoKeywordBasedRecognizerViewProps } from './ExpoKeywordBasedRecognizer.types';

const NativeView: React.ComponentType<ExpoKeywordBasedRecognizerViewProps> =
  requireNativeView('ExpoKeywordBasedRecognizer');

export default function ExpoKeywordBasedRecognizerView(props: ExpoKeywordBasedRecognizerViewProps) {
  return <NativeView {...props} />;
}
