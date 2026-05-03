let audioContext = null

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null

  if (!audioContext) {
    audioContext = new AudioContextClass()
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }

  return audioContext
}

function shapeEnvelope(gainNode, now, { attack, decay, peak, floor = 0.0001 }) {
  gainNode.gain.cancelScheduledValues(now)
  gainNode.gain.setValueAtTime(floor, now)
  gainNode.gain.linearRampToValueAtTime(peak, now + attack)
  gainNode.gain.exponentialRampToValueAtTime(floor, now + attack + decay)
}

function playLayer({
  ctx,
  type,
  frequency,
  detune = 0,
  start = 0,
  attack,
  decay,
  peak,
  filterFrequency,
}) {
  const now = ctx.currentTime + start
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  oscillator.detune.setValueAtTime(detune, now)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFrequency, now)

  shapeEnvelope(gain, now, { attack, decay, peak })

  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  oscillator.start(now)
  oscillator.stop(now + attack + decay + 0.04)
}

export function playMoveSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  playLayer({
    ctx,
    type: 'triangle',
    frequency: 560,
    attack: 0.008,
    decay: 0.09,
    peak: 0.05,
    filterFrequency: 1800,
  })

  playLayer({
    ctx,
    type: 'sine',
    frequency: 840,
    start: 0.012,
    attack: 0.005,
    decay: 0.07,
    peak: 0.025,
    filterFrequency: 2400,
  })
}

export function playCaptureSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  playLayer({
    ctx,
    type: 'sawtooth',
    frequency: 300,
    detune: -8,
    attack: 0.004,
    decay: 0.12,
    peak: 0.045,
    filterFrequency: 1200,
  })

  playLayer({
    ctx,
    type: 'triangle',
    frequency: 180,
    start: 0.016,
    attack: 0.004,
    decay: 0.16,
    peak: 0.035,
    filterFrequency: 900,
  })
}
