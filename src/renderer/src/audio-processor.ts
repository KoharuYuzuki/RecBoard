class AudioVolumeProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
  }

  process(inputs: Float32Array[][]) {
    if (inputs.length <= 0) return true
    const channel = inputs[0]
    const left = channel[0]

    const max = Math.max(...left)
    const min = Math.min(...left)

    this.port.postMessage({max, min})
    return true
  }
}

registerProcessor('audio-volume-processor', AudioVolumeProcessor)

export {}
