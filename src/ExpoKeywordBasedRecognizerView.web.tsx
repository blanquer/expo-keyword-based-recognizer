import * as React from 'react';

import { ExpoKeywordBasedRecognizerViewProps } from './ExpoKeywordBasedRecognizer.types';

export default function ExpoKeywordBasedRecognizerView(props: ExpoKeywordBasedRecognizerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
