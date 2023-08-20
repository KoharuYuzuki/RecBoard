interface Window {
  recBoard: {
    loadReclist: () => Promise<{ path: string, text: string }[]>
    saveAudio: (path: string, data: ArrayBuffer) => Promise<boolean>
  }
}
