<script lang="ts">
  import AudioVolumeProcessor from '@renderer/audio-processor?worker&url'

  export default {
    data(): {
      reclist: {
        path: string
        text: string
        volumes: {
          max: number
          min: number
        }[]
        audio: HTMLAudioElement | null
      }[],
      selectedIndex: number
      audioStreamStarted: boolean
      canvas: HTMLCanvasElement
      canvasCtx: CanvasRenderingContext2D | null
      recording: boolean
      recorder: MediaRecorder | null
    } {
      return {
        reclist: [],
        selectedIndex: 0,
        audioStreamStarted: false,
        canvas: document.createElement('canvas'),
        canvasCtx: null,
        recording: false,
        recorder: null
      }
    },
    methods: {
      loadReclist() {
        window.recBoard.loadReclist()
        .then((reclist) => {
          if (reclist.length > 0) {
            this.reclist = reclist.map((data) => {
              return {
                path: data.path,
                text: data.text,
                volumes: [],
                audio: null
              }
            })
          }
        })
        .catch(console.error)
      },
      startAudioStream() {
        if (this.audioStreamStarted) return
        this.audioStreamStarted = true

        const ctx = new AudioContext()
        let stream: MediaStream

        navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            autoGainControl: false,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        })
        .then((_stream) => {
          stream = _stream

          this.recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
          this.recorder.addEventListener('dataavailable', (event) => {
            if (event.data.size <= 0) return
            if (this.reclist.length <= 0) return

            const objectURL = URL.createObjectURL(event.data)
            const audio = new Audio()
            const path = this.reclist[this.selectedIndex].path

            audio.src = objectURL
            this.reclist[this.selectedIndex].audio = audio

            event.data.arrayBuffer()
            .then((data => window.recBoard.saveAudio(path, data)))
            .then((result) => {
              if (!result) return Promise.reject('変換または保存に失敗しました')
              return Promise.resolve()
            })
            .catch((e) => {
              console.error(e)
              alert(`音声ファイルの保存に失敗しました\n${e}`)
            })
          })

          return ctx.audioWorklet.addModule(AudioVolumeProcessor)
        })
        .then(() => {
          const streamSource = ctx.createMediaStreamSource(stream)
          const audioVolumeProcessorNode = new AudioWorkletNode(ctx, 'audio-volume-processor')

          streamSource.connect(audioVolumeProcessorNode)
          audioVolumeProcessorNode.connect(ctx.destination)

          audioVolumeProcessorNode.port.onmessage = (event) => {
            if (!this.recording) return
            if (this.reclist.length <= 0) return

            this.reclist[this.selectedIndex].volumes.push({
              max: event.data.max,
              min: event.data.min
            })
          }
        })
        .catch((e) => {
          console.error(e)
          alert('オーディオストリームの開始に失敗しました\nアプリケーションを再起動してください')
        })
      },
      drawWave() {
        if ((this.canvasCtx === null) || (this.reclist.length <= 0)) {
          requestAnimationFrame(this.drawWave)
          return
        }

        this.clearWave()
        this.canvasCtx.fillStyle = '#EF4644'

        const volumes = this.reclist[this.selectedIndex].volumes
        const width = this.canvas.width / volumes.length
        const center = 0.5

        for (let i = 0; i < volumes.length; i++) {
          const data = volumes[i]
          const x = width * i
          const y = center - data.max
          const height = Math.abs(data.max - data.min)
          this.canvasCtx.fillRect(
            x,
            y * this.canvas.height,
            width,
            height * this.canvas.height
          )
        }

        requestAnimationFrame(this.drawWave)
      },
      clearWave() {
        if (this.canvasCtx === null) return
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      },
      resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect()
        this.canvas.width = rect.width
        this.canvas.height = rect.height
      }
    },
    mounted() {
      (this.$refs.wave as HTMLElement).appendChild(this.canvas)
      this.canvasCtx = this.canvas.getContext('2d')
      this.resizeCanvas()
      this.drawWave()

      window.addEventListener('keydown', (event) => {
        if (this.reclist.length <= 0) return

        switch (event.key) {
          case 'ArrowUp':
            if (this.selectedIndex >= 1) {
              this.selectedIndex--
              this.clearWave()
            }
            break
          case 'ArrowDown':
            if (this.selectedIndex <= (this.reclist.length - 2)) {
              this.selectedIndex++
              this.clearWave()
            }
            break
          case 'r':
            if (!this.recording) {
              this.recording = true
              this.reclist[this.selectedIndex].volumes = []
              this.recorder?.start()
            }
            break
          case ' ':
            event.preventDefault()
            const audio = this.reclist[this.selectedIndex].audio
            if (audio !== null) {
              audio.currentTime = 0
              audio.play()
            }
            break
        }

        const element = document.querySelectorAll('#side > .list > .text')[this.selectedIndex]
        element.scrollIntoView(true)
      })

      window.addEventListener('keyup', (event) => {
        switch (event.key) {
          case 'r':
            if (this.recording && (this.recorder !== null) && (this.recorder.state !== 'inactive')) {
              this.recorder?.stop()
            }
            this.recording = false
            break
        }
      })

      window.addEventListener('resize', () => {
        this.resizeCanvas()
      })
    }
  }
</script>

<template>
  <div id="side">
    <button
      class="button"
      v-on:click="() => {
        loadReclist()
        startAudioStream()
      }"
    >
      録音リストを選択
    </button>
    <div class="list scrollbar">
      <p
        class="text none-message"
        v-if="reclist.length <= 0"
      >
        リストなし
      </p>
      <p
        class="text"
        v-else
        v-for="data, index in reclist"
        v-bind:class="{
          selected: (index === selectedIndex)
        }"
      >
        {{ data.text }}
      </p>
    </div>
  </div>
  <div id="text">
    <p v-if="reclist.length <= 0">
      テキストを選択してください
    </p>
    <p v-else>
      {{ reclist[selectedIndex].text }}
    </p>
  </div>
  <div id="wave" ref="wave">
  </div>
  <div id="usage">
    <p>Rキー: 押下中録音</p>
    <p>上下キー: 録音テキスト選択</p>
    <p>スペースキー: 音声再生</p>
  </div>
</template>

<style lang="scss">
  $color-red: #EF4644;
  $color-brown: #574848;
  $color-white: #FFFFFF;

  :root {
    --color-theme-1: #{$color-red};
    --color-theme-2: #{$color-white};
    --color-theme-3: #{$color-brown};

    --color-text-light: #{$color-white};
    --color-text-dark: #{$color-brown};
  }

  * {
    user-select: none;
    box-sizing: border-box;

    &.scrollbar {
      $scrollbar-size: 0;

      &::-webkit-scrollbar {
        width: $scrollbar-size;
        height: $scrollbar-size;
      }
    }
  }

  body {
    width: 100dvw;
    height: 100dvh;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
  }

  button {
    cursor: pointer;
  }

  $side-width: 200px;
  $side-margin: 8px;
  $text-height: 100px;
  $text-margin: 8px;
  $wave-margin: 8px;
  $usage-height: 30px;
  $usage-margin: 8px;

  #side {
    width: $side-width;
    height: calc(100% - ($side-margin * 2));
    margin: $side-margin;

    $button-height: 40px;
    $button-margin-bottom: 8px;

    .button {
      width: 100%;
      height: $button-height;
      margin-bottom: $button-margin-bottom;
      padding: 0;
      border: none;
      border-radius: calc($button-height / 2);
      background-color: var(--color-theme-1);
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text-light);
    }

    .list {
      width: 100%;
      height: calc(100% - ($button-height + $button-margin-bottom));
      border: 2px solid var(--color-theme-1);
      border-radius: 8px;
      background-color: var(--color-theme-2);
      overflow-y: scroll;

      .text {
        $text-margin: 4px;
        width: calc(100% - ($text-margin * 2));
        margin: $text-margin;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 400;
        color: var(--color-text-dark);

        &.selected {
          color: var(--color-theme-1);
          font-weight: 700;
        }

        &.none-message {
          height: calc(100% - ($text-margin * 2));
          display: flex;
          justify-content: center;
          align-items: center;
        }
      }
    }
  }

  #text {
    width: calc(100% - $text-margin - ($side-width + ($side-margin * 2)));
    height: $text-height;
    margin: $text-margin;
    margin-left: 0;
    display: flex;
    justify-content: flex-start;
    align-items: center;

    p {
      width: 100%;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      line-height: 30px;
      color: var(--color-text-dark);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }
  }

  #wave {
    width: calc(100% - $wave-margin - ($side-width + ($side-margin * 2)));
    height: calc(100% - ($text-height + ($text-margin * 2)) - ($usage-height + ($usage-margin * 2)));
    margin-right: $wave-margin;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;

    canvas {
      width: 100%;
      height: 100%;
    }
  }

  #usage {
    width: calc(100% - $usage-margin - ($side-width + ($side-margin * 2)));
    height: $usage-height;
    margin: $usage-margin;
    margin-left: 0;
    display: flex;
    justify-content: center;
    align-items: center;

    p {
      margin-right: 16px;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text-dark);
    }
  }
</style>
