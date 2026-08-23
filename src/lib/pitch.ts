const NOTE_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const NOTE_RU = ['До', 'До#', 'Ре', 'Ре#', 'Ми', 'Фа', 'Фа#', 'Соль', 'Соль#', 'Ля', 'Ля#', 'Си'] as const

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function noteFromFreq(freq: number): {
  name: string
  nameRu: string
  octave: number
  midi: number
  cents: number
} {
  const midiFloat = freqToMidi(freq)
  const midi = Math.round(midiFloat)
  const cents = Math.round((midiFloat - midi) * 100)
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return {
    name: `${NOTE_EN[pc]}${octave}`,
    nameRu: `${NOTE_RU[pc]} ${octave}`,
    octave,
    midi,
    cents,
  }
}

export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const n = buffer.length
  const half = Math.floor(n / 2)
  let rms = 0
  for (let i = 0; i < n; i++) rms += buffer[i] * buffer[i]
  rms = Math.sqrt(rms / n)
  if (rms < 0.012) return null

  const yin = new Float32Array(half)
  for (let tau = 1; tau < half; tau++) {
    let sum = 0
    for (let i = 0; i < half; i++) {
      const d = buffer[i] - buffer[i + tau]
      sum += d * d
    }
    yin[tau] = sum
  }

  yin[0] = 1
  let running = 0
  for (let tau = 1; tau < half; tau++) {
    running += yin[tau]
    yin[tau] *= tau / running
  }

  const threshold = 0.14
  let tauEst = -1
  for (let tau = 2; tau < half; tau++) {
    if (yin[tau] < threshold) {
      while (tau + 1 < half && yin[tau + 1] < yin[tau]) tau++
      tauEst = tau
      break
    }
  }
  if (tauEst < 0) return null

  const x0 = Math.max(tauEst - 1, 1)
  const x2 = Math.min(tauEst + 1, half - 1)
  const s0 = yin[x0]
  const s1 = yin[tauEst]
  const s2 = yin[x2]
  const denom = 2 * s1 - s2 - s0
  const better = denom === 0 ? tauEst : tauEst + (s2 - s0) / (2 * denom)
  const freq = sampleRate / better
  if (freq < 70 || freq > 1100) return null
  return freq
}
