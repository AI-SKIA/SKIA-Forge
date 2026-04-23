declare global {
  interface Window {
    skiaElectron: {
      getConfig: () => Promise<{ backendUrl: string; authToken: string; timeout: number }>;
      openFolder: () => Promise<string | null>;
      openFile: () => Promise<string | null>;
    };
  }
}

export {};
