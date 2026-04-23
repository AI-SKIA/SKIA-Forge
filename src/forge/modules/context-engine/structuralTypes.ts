export type StructuralKind =
  | "function"
  | "class"
  | "method"
  | "interface"
  | "import"
  | "export"
  | "variable"
  | "namespace"
  | "enum"
  | "type";

export type StructuralSymbol = {
  name: string;
  kind: StructuralKind;
  startLine: number;
  endLine: number;
  parentName?: string;
  filePath: string;
};

export type StructureExtractionResult = {
  symbols: StructuralSymbol[];
  engine: "tree_sitter_javascript" | "typescript" | "unsupported" | "empty";
};
