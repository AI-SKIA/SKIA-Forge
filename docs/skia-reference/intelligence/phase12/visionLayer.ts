export interface VisionInput {
  source: string;
  mimeType: string;
}

export function understandImage(_input: VisionInput): string[] {
  // TODO: Implement image understanding pipeline for semantic extraction.
  return [];
}

export function parseDiagram(_input: VisionInput): string[] {
  // TODO: Implement diagram structure and relation parsing.
  return [];
}

export function analyzeUIScreenshot(_input: VisionInput): string[] {
  // TODO: Implement UI screenshot analysis for layout and state inference.
  return [];
}
