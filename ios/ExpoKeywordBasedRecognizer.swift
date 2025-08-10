import AVFoundation
import Foundation
import Speech

class ExpoKeywordBasedRecognizer: NSObject {
  weak var delegate: ExpoKeywordBasedRecognizerDelegate?

  private let keyword: String?
  private let language: String
  var maxSilenceDuration: TimeInterval

  private let soundEnabled: Bool
  private let soundUri: String?
  private let contextualHints: [String]

  private var speechRecognizer: SFSpeechRecognizer?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private let audioEngine = AVAudioEngine()
  private var audioPlayer: AVAudioPlayer?

  private var isListeningForKeyword = false
  private var isRecognizingSpeech = false
  private var lastSpeechTimestamp: Date?
  private var silenceTimer: Timer?
  private var hasActiveTap = false

  private var meaningfulConfirmedResults: [SFSpeechRecognitionResult] = []

  init(
    keyword: String?,
    language: String,
    maxSilenceDuration: TimeInterval,
    soundEnabled: Bool,
    soundUri: String?,
    contextualHints: [String]
  ) {

    self.keyword = keyword?.lowercased()
    self.language = language
    self.maxSilenceDuration = maxSilenceDuration
    self.soundEnabled = soundEnabled
    self.soundUri = soundUri
    self.contextualHints = contextualHints

    super.init()

    setupSpeechRecognizer()
    setupAudioPlayer()
  }

  private func setupSpeechRecognizer() {

    speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: language))

    if speechRecognizer?.isAvailable == false {
      // Note, when onDeviceRecognition is set to true, and it is really not available
      // the isAvailable seems to still be true, but the recognitionTask will fail
      print(
        "!!!!!!!!!!!!!!!!!!!!!!RecognizerError.Recognizer not available for: \(language)"
      )
    }

    speechRecognizer?.defaultTaskHint = .dictation
  }

  private func setupAudioPlayer() {
    guard soundEnabled else { return }

    if let soundUri = soundUri, let url = URL(string: soundUri) {
      do {
        audioPlayer = try AVAudioPlayer(contentsOf: url)
        audioPlayer?.prepareToPlay()
      } catch {
        print("Failed to load custom sound: \\(error)")
      }
    }
  }

  private func loadDefaultSound() {
    // Use system sound
    AudioServicesPlaySystemSound(1113)  // Begin recording sound
  }

  func start() async throws {
    print("🟢 KeywordRecognizer: start() called")

    guard let speechRecognizer = speechRecognizer, speechRecognizer.isAvailable else {
      print("🔴 KeywordRecognizer: Speech recognizer unavailable!")
      throw RecognizerError.speechRecognitionUnavailable
    }

    print("🟢 KeywordRecognizer: Speech recognizer available, starting audio engine...")
    try startAudioEngine()

    print("🟢 KeywordRecognizer: Audio engine started, starting keyword listening...")
    startListening()

    print("🟢 KeywordRecognizer: start() completed successfully")
  }

  func stop() async {
    print("🟡 KeywordRecognizer: stop() called")

    audioEngine.stop()
    cleanupRecognition()
  }

  private func cleanupRecognition() {

    recognitionTask?.cancel()

    isListeningForKeyword = false  // TODO: might want to leave this true? ... or maybe start Listening is the one who's gonna set it
    isRecognizingSpeech = false
    meaningfulConfirmedResults.removeAll()
    // Not sure if we need to remove the tap here, since we are stopping the audio engine
    // if hasActiveTap {
    //   print("🟢 KeywordRecognizer: Removing audio tap from input node")
    //   audioEngine.inputNode.removeTap(onBus: 0)
    //   print("🟢 KeywordRecognizer: Removed")
    //   hasActiveTap = false
    // }

    silenceTimer?.invalidate()
    recognitionRequest = nil
    recognitionTask = nil  // If task is null it means we're not active (we have cancelled it above)

  }

  private func startAudioEngine() throws {
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.playAndRecord, mode: .measurement, options: .duckOthers)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

    let inputNode = audioEngine.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)

    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    guard let recognitionRequest = recognitionRequest else {
      throw RecognizerError.audioEngineError
    }

    recognitionRequest.shouldReportPartialResults = true
    recognitionRequest.requiresOnDeviceRecognition = false  // Won't work if true for some languages...

    // Add contextual hints with keyword at the top
    if let keyword = keyword {
      recognitionRequest.contextualStrings = [keyword] + contextualHints
    } else {
      recognitionRequest.contextualStrings = contextualHints
    }

    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
      self.recognitionRequest?.append(buffer)
    }
    hasActiveTap = true

    audioEngine.prepare()
    try audioEngine.start()
  }

  private func startListening() {
    // Start directly with the speech if no keyword is specified
    isListeningForKeyword = self.keyword != nil
    isRecognizingSpeech = self.keyword == nil

    recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest!) {
      [weak self] result, error in
      guard let self = self else { return }

      if let error = error {
        // This can happen if the language is not supported ... cannot read assets or something
        // TODO: Maybe there's a way to really detect the languages that are truly supported... even if it's forced to use onDeviceRecognition?
        //  .. and bail earlier (and even only include those in the options for selection)
        self.delegate?.recognitionError(error)
        return
      }

      guard let result = result else { return }
      print(
        "🟢 KeywordRecognizer: Received (isFinal? \(result.isFinal) ) best recognition result: \(result.bestTranscription.formattedString)"
      )
      // let countSegmentsPreTranscription = result.transcriptions.map { String($0.segments.count) }
      // print("🟢 KeywordRecognizer: segment count per transcription: \(countSegmentsPreTranscription.joined(separator: ", "))")
      // print("🟢 KeywordRecognizer: first transcription \(result.transcriptions[0].formattedString) ")
      // print("🟢 KeywordRecognizer: isRecognizingSpeech? \(self.isRecognizingSpeech) isListeningForKeyword? \(self.isListeningForKeyword)")
      if self.isListeningForKeyword {
        print(
          "[\(currentTime)] 🟡 ============<SPEECH RECOGNITION RESULT (FOR KEYWORD)>====================="
        )
        printReceivedTranscription(result)
        self.checkForKeyword(in: result)
      } else if self.isRecognizingSpeech {
        self.processRecognitionResult(result)
      }
    }
  }

  private func printReceivedTranscription(_ result: SFSpeechRecognitionResult) {

    let meta_start = result.speechRecognitionMetadata?.speechStartTimestamp
    let meta_duration = result.speechRecognitionMetadata?.speechDuration
    print(
      "🟢 TRANSCRIPTION: start: \(String(describing: meta_start)), speechDuration: \(String(describing: meta_duration)) -------------------------------------------------"
    )
    // print(
    //   "🟢  - BEST: Received transcription: \(result.bestTranscription.formattedString.lowercased())")

    // Print all segments for debugging
    for segment in result.bestTranscription.segments {
      print(
        "🟢   - '\(segment.timestamp) : \(segment.substring)' [duration \(segment.duration)] [confidence \(segment.confidence)]"
      )
    }
  }
  private func checkForKeyword(in result: SFSpeechRecognitionResult) {
    let transcript = result.bestTranscription.formattedString.lowercased()
    // print("🟢 KeywordRecognizer: Checking for keyword: [\(transcript)]")

    // Check if the transcript contains the keyword
    if let keyword = keyword {
      if transcript.contains(keyword) {
        print("🟢 KeywordRecognizer: KEYWORD FOUND!")
        handleKeywordDetected()
      }
    } else {
      // If no keyword is specified, immediately trigger speech recognition
      print("🟢 KeywordRecognizer: No keyword specified, triggering recognition immediately")
      handleKeywordDetected()
    }
  }

  private func handleKeywordDetected() {
    isListeningForKeyword = false
    isRecognizingSpeech = true

    // Play sound
    if soundEnabled {
      if let audioPlayer = audioPlayer {
        audioPlayer.play()
      } else {
        AudioServicesPlaySystemSound(1113)
      }
    }

    // Notify delegate
    delegate?.keywordDetected(keyword: keyword ?? "")
    delegate?.recognitionStarted()
  }

  // When this is called, it means that we have detected the keyword (in a partial result), so the any 'confirmed' results after this point are meaningful, and therefore we need to store them
  // Hopefully, the first of those results will contain the keyword (i.e., partial results might not be the same as the final results) ... but regardless, we know that the first result
  // is deemed to have it, and if we don't find it (cause of mismatch of partial/final results), we can send it from the beggining (since the text, even it it has a partial keyword, is still meaningful)
  private func processRecognitionResult(_ result: SFSpeechRecognitionResult) {

    print("[\(currentTime)] 🟡 ============<SPEECH RECOGNITION RESULT>=====================")
    printReceivedTranscription(result)
    // if not final, save the result to our confirmed results list
    // if final, we will process the accumulated segments, and send the final result
    if result.isFinal {
      // print(
      //   "🟢 KeywordRecognizer: Final result received, processing accumulated segments \(result.bestTranscription.formattedString.lowercased())"
      // )
      // print("🟢 KeywordRecognizer: We have \(meaningfulConfirmedResults.count) saved results:")
      // for (index, confirmedResult) in meaningfulConfirmedResults.enumerated() {
      //   print(
      //     "🟢 KeywordRecognizer: \(index + 1): \(confirmedResult.bestTranscription.formattedString.lowercased())"
      //   )
      // }
      // Play sound when the final result is received
      if soundEnabled {
        if let audioPlayer = audioPlayer {
          audioPlayer.play()
        } else {
          AudioServicesPlaySystemSound(1114)
        }
      }
      // Add the current result to the confirmed results (which could be empty, because we might have just
      // detected the keyword together in the same last result)
      let resultsToProcess: [SFSpeechRecognitionResult] = meaningfulConfirmedResults + [result]
      // Get the first result, and extract the text AFTER the keyword
      let firstPiece: String
      let firstResult: String =
        resultsToProcess.first?.bestTranscription.formattedString.lowercased() ?? ""
      // find the index of the keyword in the initial speech
      if let keyword = keyword,
        let keywordIndex: String.Index = firstResult.range(of: keyword)?.lowerBound
      {
        // Extract the text after the keyword
        let startIndex: String.Index = firstResult.index(keywordIndex, offsetBy: keyword.count)
        firstPiece = String(firstResult[startIndex...])
      } else {
        // If keyword not found or no keyword specified, use the initial speech as is
        firstPiece = firstResult
      }
      let rest = resultsToProcess.dropFirst().map {
        $0.bestTranscription.formattedString.lowercased()
      }
      let fullSpeech = ([firstPiece] + rest).joined(separator: " ")
      // print("🟢 PROCESSED FULL SPECH: \(fullSpeech)")
      // Notify delegate with the final result
      // Prepare the struct (RecognitionResult in JS)
      let res = RecognitionResult(text: fullSpeech, isFinal: true)
      recognitionRequest?.endAudio()  // End the audio request to signal completion to the recognizer
      delegate?.recognitionResult(res)
      cleanupRecognition()
    } else {
      if result.speechRecognitionMetadata?.speechStartTimestamp != nil {
        // Save the result to our confirmed results list
        meaningfulConfirmedResults.append(result)
      }  // No need to save interim results for the real speech part, we will process them when the final result is received
    }

    // Get all segments from current result

    // let mdt = result.speechRecognitionMetadata?.speechStartTimestamp
    // let mdd = result.speechRecognitionMetadata?.speechStartTimestamp
    // print(
    //   "🟢 KeywordRecognizer: Metadata - speechStartTimestamp: \(String(describing: mdt)) for \(String(describing: mdd))"
    // )

    // If the result is not final (or semi-final i.e., has timestamps), we need to start a silence timer
    let is_complete_ish_result = result.speechRecognitionMetadata?.speechStartTimestamp != nil
    let needsSilenceTimer = !result.isFinal && !is_complete_ish_result
    print(
      "[\(currentTime)] 🟡 JOSEP: COMPLETEISH: \(String(describing:is_complete_ish_result)) needsSilenceTimer: \(needsSilenceTimer) isFinal: \(result.isFinal) "
    )
    if needsSilenceTimer {
      print(
        "[\(currentTime)] 🟡 KeywordRecognizer: Interim result received, starting silence timer \(String(describing:is_complete_ish_result))"
      )
      // Handle silence detection
      silenceTimer?.invalidate()
      silenceTimer = Timer.scheduledTimer(withTimeInterval: maxSilenceDuration, repeats: false) {
        [weak self] _ in
        self?.handleSilenceTimeout()
      }
    } else {
      // Final result received
      print(
        "🟢 KeywordRecognizer: Final result - accumulated: \(result.bestTranscription.formattedString.lowercased())"
      )

    }
  }

  private var currentTime: String {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss.SSS"
    return formatter.string(from: Date())
  }
  private func handleSilenceTimeout() {
    print("🟡 KeywordRecognizer: Silence timeout reached, finishing recognition task")
    // Force the recognition to finish
    if let recognitionTask = recognitionTask {
      print(
        "[\(currentTime)] 🟡 KeywordRecognizer: Calling finish on recognition task due to silence timeout! is finishing? \(recognitionTask.isFinishing)"
      )
      recognitionTask.finish()
    }

    // The final result will trigger the state reset in processRecognitionResult
  }

}
