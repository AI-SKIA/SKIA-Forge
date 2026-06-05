declare global {
  type SkiaDirectoryNode = {
    name: string;
    path: string;
    type: "file" | "directory";
    children?: SkiaDirectoryNode[];
  };

  interface Window {
    skiaElectron: {
      getConfig: () => Promise<{
        backendUrl: string;
        authToken: string;
        timeout: number;
        chatPipelineUrl?: string;
        forgeAgentPipelineUrl?: string;
        localBackendMode?: boolean;
        localSkiaServeUrl?: string;
        localEmbeddingEngineUrl?: string;
        localVectorDbUrl?: string;
        localVideoServiceUrl?: string;
        localComfyuiUrl?: string;
        localSdWebuiUrl?: string;
        localFounderOverride?: boolean;
        skiaOwnerEmail?: string;
      }>;
      getAppVersion: () => string;
      openFolder: () => Promise<string | null>;
      openFile: () => Promise<string | null>;
      saveFile: (filePath: string, content: string) => Promise<boolean>;
      saveFileAs: (content: string) => Promise<string | null>;
      readFileText: (filePath: string) => Promise<string>;
      readDirectoryTree: (folderPath: string) => Promise<SkiaDirectoryNode[]>;
      onMenuAction: (channel: string, listener: () => void) => () => void;
      /** Run → Open Terminal: receives `{ cwd }` from main (opened project root). */
      onOpenTerminal: (listener: (payload: { cwd: string }) => void) => () => void;
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
      runCommand: (cmd: string, cwd?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

      getProjectRoot: () => Promise<string | null>;
      setProjectRoot: (folderPath: string) => Promise<void>;
      onProjectRootChanged: (listener: (root: string) => void) => () => void;

      ptyCreate: (cwd?: string) => Promise<{ id: string; cwd: string; shell: string }>;
      ptyWrite: (id: string, data: string) => void;
      ptyResize: (id: string, cols: number, rows: number) => void;
      ptyKill: (id: string) => Promise<void>;
      onPtyData: (listener: (payload: { id: string; data: string }) => void) => () => void;
      onPtyExit: (listener: (payload: { id: string; exitCode: number; signal?: number }) => void) => () => void;

      checkForUpdates: () => Promise<{
        status: "update-available" | "up-to-date" | "error";
        latestVersion?: string;
        downloadUrl?: string;
        currentVersion?: string;
        message?: string;
      }>;
      /** Tell main the update listener is attached (replays cached update-available if needed). */
      notifyRendererReady: () => void;
      setAutoSave: (enabled: boolean) => void;
      openDocs: () => void;
      /** Auth via main process (avoids file:// CORS blocking api.skia.ca). */
      authRequest: (input: {
        path: string;
        method: "GET" | "POST";
        body?: Record<string, unknown>;
        bearerToken?: string;
      }) => Promise<{ ok: boolean; status: number; text: string }>;
      getCookies: (url: string) => Promise<Array<{ name: string; value: string }>>;
      openExternal: (url: string) => void;
      saveCredentials: (email: string, password: string) => Promise<boolean>;
      getSavedCredentials: () => Promise<{ email: string; password: string } | null>;
      clearSavedCredentials: () => Promise<boolean>;
      /** Sync Electron menu bar with renderer UI language (skia-ui-locale). */
      notifyLocaleChanged: (locale: string) => void;
    };
  }
}

export {};
