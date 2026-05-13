let audioContext: AudioContext | null = null;
let noiseSource: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const bufferSize = context.sampleRate * 2;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const output = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    output[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

export function startWhiteNoise(volume = 0.2): void {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  if (noiseSource && gainNode) {
    gainNode.gain.value = volume;
    return;
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();

  source.buffer = createNoiseBuffer(audioContext);
  source.loop = true;
  gain.gain.value = volume;

  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start();

  noiseSource = source;
  gainNode = gain;
}

export function setWhiteNoiseVolume(volume: number): void {
  if (gainNode) {
    gainNode.gain.value = volume;
  }
}

export function stopWhiteNoise(): void {
  if (noiseSource) {
    try {
      noiseSource.stop();
    } catch {
      // Ignore stop errors when node is already stopped.
    }
    noiseSource.disconnect();
    noiseSource = null;
  }

  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }

  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
}
