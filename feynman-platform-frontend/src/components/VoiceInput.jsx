// src/components/VoiceInput.jsx
// 可复用的语音输入：录音 → 16kHz WAV → 百度语音识别 → 回调文本。
// 支持暂停 / 继续，识别结果由父组件决定插入到哪里（例如知识点内容末尾）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactMediaRecorder } from 'react-media-recorder';
import apiClient from '../api/axios';
import { blobToWavFile } from '../utils/audio';
import getErrorMessage from '../utils/getErrorMessage';
import { RECORDER_STATUS_TEXT, formatDuration, getRecorderErrorText } from '../utils/recorder';

function VoiceInput({ onTranscribed, disabled = false }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [notice, setNotice] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // 暂停会让计时 effect 重启，因此要累计每次「录音中」片段的时长。
  const accumulatedMsRef = useRef(0);
  const runningSinceRef = useRef(null);
  const stopHandlerRef = useRef(null);

  const {
    status,
    error: recorderError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearBlobUrl,
    mediaBlobUrl,
  } = useReactMediaRecorder({
    audio: true,
    onStop: (blobUrl, blob) => {
      stopHandlerRef.current?.(blob);
    },
  });

  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isBusy =
    status === 'acquiring_media' || status === 'stopping' || isUploading;

  useEffect(() => {
    if (status !== 'recording') return undefined;

    runningSinceRef.current = Date.now();
    const tick = () => {
      const running = runningSinceRef.current ? Date.now() - runningSinceRef.current : 0;
      setElapsed(Math.floor((accumulatedMsRef.current + running) / 1000));
    };
    tick();
    const timer = setInterval(tick, 500);

    return () => {
      clearInterval(timer);
      if (runningSinceRef.current) {
        accumulatedMsRef.current += Date.now() - runningSinceRef.current;
        runningSinceRef.current = null;
      }
      setElapsed(Math.floor(accumulatedMsRef.current / 1000));
    };
  }, [status]);

  const handleRecordingStopped = useCallback(
    async (blob) => {
      if (!blob) return;
      setIsUploading(true);
      setUploadError('');
      setNotice('');

      try {
        const wavFile = await blobToWavFile(blob, 'knowledge-point-voice.wav');
        const formData = new FormData();
        formData.append('audio', wavFile);

        const response = await apiClient.post('/audio/transcribe', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const text = (response.data.result || '').trim();
        if (!text) {
          setUploadError('没有识别到文字，请靠近麦克风再录一次。');
          return;
        }

        onTranscribed?.(text);
        setNotice('识别完成，文字已追加到内容末尾，可以直接编辑。');
      } catch (err) {
        setUploadError(getErrorMessage(err, '语音识别失败，请重试'));
      } finally {
        setIsUploading(false);
      }
    },
    [onTranscribed],
  );

  useEffect(() => {
    stopHandlerRef.current = handleRecordingStopped;
  }, [handleRecordingStopped]);

  const handleStart = () => {
    accumulatedMsRef.current = 0;
    runningSinceRef.current = null;
    setElapsed(0);
    setUploadError('');
    setNotice('');
    if (mediaBlobUrl) clearBlobUrl();
    startRecording();
  };

  const errorText = uploadError || getRecorderErrorText(recorderError);

  return (
    <div className="voice-input">
      <div className="voice-input-header">
        <span className="voice-input-title">语音输入</span>
        <span
          className={`record-status ${isRecording ? 'is-recording' : ''} ${
            isPaused ? 'is-paused' : ''
          }`.trim()}
        >
          <span className="record-dot" />
          {isUploading ? '正在识别…' : RECORDER_STATUS_TEXT[status] || status}
          {isRecording && <strong className="record-timer">{formatDuration(elapsed)}</strong>}
        </span>
      </div>

      <p className="record-hint">
        对着麦克风说出知识点内容，停止后识别文字会追加到下方内容，并可以继续编辑。
        百度短语音识别单次限制约 60 秒，内容较长时请分段录制。
      </p>

      {errorText && (
        <p className="form-error" role="alert">
          {errorText}
        </p>
      )}
      {notice && !errorText && <p className="form-notice">{notice}</p>}

      <div className="voice-input-actions">
        {isRecording && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={pauseRecording}
          >
            暂停录音
          </button>
        )}

        {isPaused && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={resumeRecording}
          >
            继续录音
          </button>
        )}

        {!isRecording && !isPaused && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleStart}
            disabled={disabled || isBusy}
          >
            {status === 'acquiring_media' ? '正在请求麦克风…' : '开始语音输入'}
          </button>
        )}

        {(isRecording || isPaused) && (
          <button type="button" className="btn btn-danger btn-sm" onClick={stopRecording}>
            停止并识别
          </button>
        )}
      </div>
    </div>
  );
}

export default VoiceInput;
