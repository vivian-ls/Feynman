// src/utils/audio.js

// 将浏览器录制的音频（通常是 48kHz 的 WAV）转换为百度短语音识别要求的
// 16kHz、单声道、16-bit PCM WAV 文件。

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk 长度
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 单声道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // 字节率 = 采样率 × 声道数 × 位深/8
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

export async function blobToWavFile(blob, filename = 'recording.wav') {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  if (!AudioContextClass || !OfflineAudioContextClass) {
    throw new Error('当前浏览器不支持音频处理，请使用最新版 Chrome 或 Edge');
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextClass();

  let decoded;
  try {
    decoded = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    if (audioContext.close) await audioContext.close();
  }

  const targetSampleRate = 16000;
  const frameCount = Math.max(1, Math.round(decoded.duration * targetSampleRate));

  // OfflineAudioContext 会完成重采样，并把多声道下混为单声道。
  const offlineContext = new OfflineAudioContextClass(1, frameCount, targetSampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineContext.destination);
  source.start();

  const rendered = await offlineContext.startRendering();
  const wavBuffer = encodeWav(rendered.getChannelData(0), targetSampleRate);

  return new File([wavBuffer], filename, { type: 'audio/wav' });
}
