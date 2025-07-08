

export type OnLoadEventPayload = {
  url: string;
};

export type ExpoKeywordBasedRecognizerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};

export type ChangeEventPayload = {
  value: string;
};

