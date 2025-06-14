// Tauri global type declarations
declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_METADATA__?: any;
  }
}

export {};
