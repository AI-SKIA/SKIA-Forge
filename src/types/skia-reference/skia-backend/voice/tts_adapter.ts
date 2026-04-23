export interface TtsRequest {
  text: string;
  profileId?: string;
}

export interface TtsResult {
  audio: Uint8Array;
}

export function synthesizeSpeech(_request: TtsRequest): TtsResult {
  // TODO: Implement backend TTS adapter.
  return { audio: new Uint8Array() };
}
