import { useEvent } from 'expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import ExpoKeywordBasedRecognizer, { KeywordDetectionEvent, KeywordRecognizerState, KeywordRecognizerStateEnum, RecognitionResult } from 'expo-keyword-based-recognizer';
import React, { ReactElement, useEffect, useState } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

export default function App() {
  const [keyword, setKeyword] = useState<string>("Hey Chef");
  const [silenceDelay, setSilenceDelay] = useState<number>(1500);
  // console.log("🔴 DEBUG: App component loaded");
  const onChangePayload = useEvent(ExpoKeywordBasedRecognizer, 'onChange'); // DELETE ... from orig module
  const listeningState = useEvent(ExpoKeywordBasedRecognizer, 'onStateChange', null);
  // const onRecognitionStart = useEvent(ExpoKeywordBasedRecognizer, 'onRecognitionStart');
  // const onKeywordDetectedPayload = useEvent(ExpoKeywordBasedRecognizer, 'onKeywordDetected',);
  // const onRecognitionResultPayload = useEvent(ExpoKeywordBasedRecognizer, 'onRecognitionResult');
  const onErrorPayload = useEvent(ExpoKeywordBasedRecognizer, 'onError');

  const [detectedKeyword, setDetectedKeyword] = useState<string|null>(null);
  const [recognizedSentence, setRecognizedSentence] = useState<string|null>(null);

  
  const onKeywordDetected = (event: KeywordDetectionEvent) => {
      // const now = new Date();
      // const timeString = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}`;
      // console.log(`🔴 JS KEYWORD DETECTED LISTENER:  ${event.keyword} (time=> ${timeString})`);
      setDetectedKeyword(event.keyword);
  }
  const onRecognitionResult = (result: RecognitionResult) => {
    setRecognizedSentence(result.text);
  }
  useEffect(() => {
    // Set up event listeners
    ExpoKeywordBasedRecognizer.addListener("onKeywordDetected",onKeywordDetected);
    ExpoKeywordBasedRecognizer.addListener("onRecognitionResult",onRecognitionResult);
    return () => {
      // Clean up event listeners
      ExpoKeywordBasedRecognizer.removeListener('onKeywordDetected',onKeywordDetected);
      ExpoKeywordBasedRecognizer.removeListener('onRecognitionResult',onRecognitionResult);
    };
  }, []);


  const requestPermissions = async () => {
    try {
      const permissions =
        await ExpoKeywordBasedRecognizer.requestPermissionsAsync();
      Alert.alert(
        "Permission Request Result",
        `Speech Recognition: ${permissions.status}\\n` +
          `Granted: ${permissions.granted ? "Yes" : "No"}\\n` +
          `Can Ask Again: ${permissions.canAskAgain ? "Yes" : "No"}`
      );
    } catch (error: any) {
      Alert.alert("Permission Error", error.message);
    }
  };

  const startListening = async () => {
    try {
      setDetectedKeyword(null);
      setRecognizedSentence(null);
      console.log("🔴 DEBUG: Starting to activate recognizer...");
      // setError(null);

      const options = {
        keyword: keyword,
        language: "en-US",
        confidenceThreshold: 0.7,
        maxSilenceDuration: silenceDelay,
        soundEnabled: true,
        interimResults: true,
        contextualHints: [
        ],
      };

      // console.log("🔴 DEBUG: Options:", options);

      await ExpoKeywordBasedRecognizer.activate(options);

      // console.log("🔴 DEBUG: Activate completed successfully");
      // setIsActive(true);
    } catch (err: any) {
      console.log("🔴 DEBUG: Error in startListening:", err);
      // setError(err.message);
      // Alert.alert("Error", err.message);
    }
  };

  const cancelListening = async () => {
    try {
      console.log("🔴 DEBUG: Cancelling listening...");
      await ExpoKeywordBasedRecognizer.deactivate();
      console.log("🔴 DEBUG: Cancel completed successfully");
    } catch (err: any) {
      console.log("🔴 DEBUG: Error in cancelListening:", err);
      // setError(err.message);
      // Alert.alert("Error", err.message);
    }
  };
  const listeningStateToComponent = (state: KeywordRecognizerState | null): ReactElement => {
    // console.log("🔴 DEBUG: listeningStateToComponent called with state:", state);
    const commonState = state?.state  || KeywordRecognizerStateEnum.IDLE as KeywordRecognizerStateEnum;
    let string = '';
    let icon: React.ComponentProps<typeof Ionicons>['name'] = "checkmark-circle";
    switch (commonState) {
      case KeywordRecognizerStateEnum.IDLE:
        string = 'Idle';
        icon = "pause-circle-outline";
        break;
      case KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD:
        string = 'Listening for keyword';
        icon = "mic-outline";
        break;
      case KeywordRecognizerStateEnum.RECOGNIZING_SPEECH:
        string = 'Recognizing speech';
        icon = "chatbubbles-outline"
        break;
      case KeywordRecognizerStateEnum.PROCESSING: // ????
        string = 'Processing';
        icon = "chatbubbles-outline"
        break;
      default:
        string = 'Unknown state';
        icon = "help-circle-outline";
        break;
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', padding: 10 }}>
      {icon && <Ionicons name={icon} size={22} />}
      <Text style={{ fontStyle: 'italic', marginLeft: 10 }}>({string})</Text>
      </View>
    )
  };
  
  const isListening = listeningState?.state !== KeywordRecognizerStateEnum.IDLE;
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Keyword Recognition Example</Text>
        <Group name="Configuration">
          <View style={{ marginBottom: 10 }}>
            <Text style={{ marginBottom: 5 }}>Keyword:</Text>
            <TextInput
              style={[styles.input, isListening && styles.inputDisabled]}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="Enter keyword"
              editable={!isListening}
            />
          </View>
          <View>
            <Text style={{ marginBottom: 5 }}>Silence Delay (ms):</Text>
            <TextInput
              style={[styles.input, isListening && styles.inputDisabled]}
              value={silenceDelay.toString()}
              onChangeText={(text) => setSilenceDelay(parseInt(text) || 0)}
              placeholder="Enter silence delay"
              keyboardType="numeric"
              editable={!isListening}
            />
          </View>
        </Group>
        <Group name="Detection">
          <View style={{ flexDirection: 'row' , alignItems: 'center',  alignContent: 'space-between', gap: 10 , width: '100%'}}>
            <Text>State: </Text>
            {listeningStateToComponent(listeningState)}
          </View>
          <View style={{ flexDirection: 'row' , alignItems: 'center',  alignContent: 'space-between', gap: 10 , width: '100%'}}>
            <Text>Keyword detection</Text>
            { detectedKeyword && (
              <Ionicons name="checkmark-circle" size={22} color="green" />  
            )}
            {!detectedKeyword && (
              <Ionicons name="ellipsis-horizontal-circle-outline" size={22} color={'gray'}/>  
            )}
          </View>
        </Group>
        <Group name="Recognition Result">
          <Text>{recognizedSentence || '---'}</Text>
        </Group>
        <Group name="Error">
          <Text>{onErrorPayload?.message || 'None'}</Text>
        </Group>
        {/* <Group name="Functions">
          <Text>{ExpoKeywordBasedRecognizer.hello()}</Text>
        </Group> */}
        <Group name="Actions">
          {/* <Button
            title="Set value"
            onPress={async () => {
              await ExpoKeywordBasedRecognizer.setValueAsync('Hello from JS!');
            }}
          />  */}
          <Button
          title={ "Listen"}
          onPress={startListening}
        />
        <Button
          title={ "Cancel"}
          onPress={cancelListening}
        />
        <Button
          title={ "Request Permissions"}
          onPress={requestPermissions}
        />
        </Group>

      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = {
  header: {
    fontSize: 20,
    margin: 10,
  },
  groupHeader: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  group: {
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#eee',
  },
  view: {
    flex: 1,
    height: 200,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputDisabled: {
    backgroundColor: '#e0e0e0',
    color: '#666',
  },
};
