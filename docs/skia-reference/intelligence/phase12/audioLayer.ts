export interface AudioInput {
  source: string;
  format: string;
}

export function handleVoiceCommand(_input: AudioInput): string {
  // TODO: Implement intent extraction from voice commands.
  return "";
}

export function transcribeAudio(_input: AudioInput): string {
  // TODO: Implement transcription flow with timestamped segments.
  return "";
}

export function reasonOverAudio(_input: AudioInput): string[] {
  // TODO: Implement audio-native reasoning over acoustic and spoken features.
  return [];
}
