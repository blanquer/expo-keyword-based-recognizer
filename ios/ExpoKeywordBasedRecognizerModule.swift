import AVFoundation
import ExpoModulesCore
import Speech

// Result back to the JavaScript side
public struct RecognitionResult {
  let text: String
  let isFinal: Bool
}

public class ExpoKeywordBasedRecognizerModule: Module {

  private var recognizer: KeywordRecognizer?
  private var state: RecognizerState = .idle

  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoKeywordBasedRecognizer')` in JavaScript.
    Name("ExpoKeywordBasedRecognizer")

    // Defines event names that the module can send to JavaScript.
    Events(
      "onChange",
      "onStateChange",
      "onKeywordDetected",
      "onRecognitionStart",
      "onRecognitionResult",
      "onError")

    // Defines a JavaScript synchronous function that runs the native code on the JavaScript thread.
    // Function("hello") {
    //   return "Hello world! 👋"
    // }

    // // Defines a JavaScript function that always returns a Promise and whose native code
    // // is by default dispatched on the different thread than the JavaScript runtime runs on.
    // AsyncFunction("setValueAsync") { (value: String) in
    //   // Send an event to JavaScript.
    //   self.sendEvent(
    //     "onChange",
    //     [
    //       "value": value
    //     ])
    // }
    AsyncFunction("activate") { (options: [String: Any]) in
      try await self.activate(options: options)
    }

    AsyncFunction("deactivate") {
      await self.deactivate()
    }

    AsyncFunction("requestPermissionsAsync") {
      return try await self.requestPermissions()
    }
  }

  private func activate(options: [String: Any]) async throws {
    print("🔴 NATIVE DEBUG: activate() called with options: \(options)")

    let keyword: String? = options["keyword"] as? String
    let language = options["language"] as? String ?? "en-US"
    let maxSilenceDuration = (options["maxSilenceDuration"] as? Double ?? 2000) / 1000.0
    let soundEnabled = options["soundEnabled"] as? Bool ?? true
    let soundUri = options["soundUri"] as? String
    let contextualHints = options["contextualHints"] as? [String] ?? []

    let keywordToDisplay = keyword ?? "nil"
    print("🔴 NATIVE DEBUG: Parsed - keyword: '\(keywordToDisplay)', language: '\(language)'")

    if keyword != nil && keyword!.isEmpty {
      print("🔴 NATIVE DEBUG: ERROR - keyword is empty (and not nil)")
      throw RecognizerError.invalidKeyword
    }

    print("🔴 NATIVE DEBUG: Creating KeywordRecognizer...")
    recognizer = KeywordRecognizer(
      keyword: keyword,
      language: language,
      maxSilenceDuration: maxSilenceDuration,
      soundEnabled: soundEnabled,
      soundUri: soundUri,
      contextualHints: contextualHints
    )

    print("🔴 NATIVE DEBUG: Setting delegate...")
    recognizer?.delegate = self

    print("🔴 NATIVE DEBUG: Starting recognizer...")
    try await recognizer?.start()

    print("🔴 NATIVE DEBUG: Updating state based on keyword presence...")
    if keyword != nil {
      updateState(.listeningForKeyword)
    } else {
      updateState(.recognizingSpeech)
    }

    print("🔴 NATIVE DEBUG: activate() completed successfully")
  }

  private func deactivate() async {
    await recognizer?.stop()
    recognizer = nil
    updateState(.idle)
  }

  private func requestPermissions() async throws -> [String: Any] {
    let speechStatus = await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { status in
        continuation.resume(returning: status)
      }
    }

    let microphoneStatus = await withCheckedContinuation { continuation in
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        continuation.resume(returning: granted)
      }
    }

    let granted = speechStatus == .authorized && microphoneStatus
    let status = granted ? "granted" : (speechStatus == .denied ? "denied" : "undetermined")

    return [
      "status": status,
      "granted": granted,
      "canAskAgain": speechStatus != .denied,
    ]
  }
  private func updateState(_ newState: RecognizerState) {
    // print("🟡 NATIVE DEBUG: updateState called - changing from \(state.rawValue) to \(newState.rawValue)")
    state = newState
    print("🟡 NATIVE DEBUG: Sending stateChange event to JavaScript...", newState.rawValue)
    sendEvent("onStateChange", ["state": newState.rawValue])
    // print("🟡 NATIVE DEBUG: stateChange event sent")
  }
}

extension ExpoKeywordBasedRecognizerModule: KeywordRecognizerDelegate {
  func keywordDetected(keyword: String) {
    updateState(.recognizingSpeech)
    print("🟢 NATIVE DEBUG: ----------------------------------------Keyword detected: '\(keyword)'")
    sendEvent(
      "onKeywordDetected",
      [
        "keyword": keyword,
        "timestamp": Date().timeIntervalSince1970 * 1000,
      ])
  }

  func recognitionStarted() {
    sendEvent("onRecognitionStart")
  }

  func recognitionResult(_ result: RecognitionResult) {
    print("🟢 NATIVE DEBUG: Setting to idle...")
    updateState(.idle)
    sendEvent(
      "onRecognitionResult",
      [
        "text": result.text,
        "isFinal": result.isFinal,
      ])

  }

  func recognitionError(_ error: Error) {
    print("🔴 NATIVE DEBUG: Recognition error occurred: \(error.localizedDescription)")
    sendEvent(
      "onError",
      [
        "message": error.localizedDescription,
        "code": (error as NSError).code,
      ])
  }
}

enum RecognizerState: String {
  case idle = "idle"
  case listeningForKeyword = "listening_for_keyword"
  case recognizingSpeech = "recognizing_speech"
  case processing = "processing"
}

enum RecognizerError: Error {
  case invalidKeyword
  case microphoneAccessDenied
  case speechRecognitionUnavailable
  case audioEngineError
}

// MARK: - Delegate Protocol
protocol KeywordRecognizerDelegate: AnyObject {
  func keywordDetected(keyword: String)
  func recognitionStarted()
  func recognitionResult(_ result: RecognitionResult)
  func recognitionError(_ error: Error)
}
