declare global {
  type SkiaDirectoryNode = {
    name: string;
    path: string;
    type: "file" | "directory";
    children?: SkiaDirectoryNode[];
  };

  interface Window {
    skiaElectron: {
      getConfig: () => Promise<{ backendUrl: string; authToken: string; timeout: number }>;
      openFolder: () => Promise<string | null>;
      openFile: () => Promise<string | null>;
      saveFile: (filePath: string, content: string) => Promise<boolean>;
      saveFileAs: (content: string) => Promise<string | null>;
      readFileText: (filePath: string) => Promise<string>;
      readDirectoryTree: (folderPath: string) => Promise<SkiaDirectoryNode[]>;
      onMenuAction: (channel: string, listener: () => void) => () => void;
      onBackendLog: (listener: (payload: string) => void) => () => void;
      onStatusUpdate: (listener: (status: string) => void) => () => void;
      onUpdateStatus: (
        listener: (payload: {
          status: "update-available" | "up-to-date" | "error";
          latestVersion?: string;
          downloadUrl?: string;
          currentVersion?: string;
          message?: string;
        }) => void
      ) => () => void;
      runCommand: (cmd: string, cwd?: string) => Promise<{ stdout: string; stderr: string }>;
      checkForUpdates: () => Promise<{
        status: "update-available" | "up-to-date" | "error";
        latestVersion?: string;
        downloadUrl?: string;
        currentVersion?: string;
        message?: string;
      }>;
      setAutoSave: (enabled: boolean) => void;
      openDocs: () => void;
      getCookies: (url: string) => Promise<Array<{ name: string; value: string }>>;
      openExternal: (url: string) => void;
      saveCredentials: (email: string, password: string) => Promise<boolean>;
      getSavedCredentials: () => Promise<{ email: string; password: string } | null>;
      clearSavedCredentials: () => Promise<boolean>;
    };
  }
}

export {};
