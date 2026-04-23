export interface DocumentInput {
  source: string;
  kind: "pdf" | "notebook" | "spreadsheet";
}

export function parsePdf(_input: DocumentInput): string[] {
  // TODO: Implement PDF parsing with structural section awareness.
  return [];
}

export function reasonOverNotebook(_input: DocumentInput): string[] {
  // TODO: Implement notebook reasoning across code, markdown, and outputs.
  return [];
}

export function reasonOverSpreadsheet(_input: DocumentInput): string[] {
  // TODO: Implement spreadsheet reasoning over tables and formulas.
  return [];
}
