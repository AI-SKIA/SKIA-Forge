export type SkiaMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const MAX_MESSAGES = 50;
const WORKSPACE_KEY = "skia_workspace_path";
const ACTIVE_FILE_KEY = "skia_active_file";

const historyKey = (): string => {
  const workspace = localStorage.getItem(WORKSPACE_KEY) || "default";
  return `skia_history_${workspace}`;
};

export const setWorkspacePath = (workspacePath: string): void => {
  localStorage.setItem(WORKSPACE_KEY, workspacePath);
};

export const addMessage = (message: SkiaMessage): void => {
  const history = getHistory();
  const next = [...history, message];
  const trimmed = next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
  localStorage.setItem(historyKey(), JSON.stringify(trimmed));
};

export const getHistory = (): SkiaMessage[] => {
  const raw = localStorage.getItem(historyKey());
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as SkiaMessage[];
  } catch {
    return [];
  }
};

export const clearHistory = (): void => {
  localStorage.removeItem(historyKey());
};

export const getActiveFile = (): string => localStorage.getItem(ACTIVE_FILE_KEY) ?? "";

export const setActiveFile = (filePath: string): void => {
  localStorage.setItem(ACTIVE_FILE_KEY, filePath);
};
