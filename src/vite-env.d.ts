/// <reference types="vite/client" />

interface ElectronAPI {}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
