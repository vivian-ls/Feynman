// src/pages/FeynmanRecordPage.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReactMediaRecorder } from 'react-media-recorder';
import apiClient from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { blobToWavFile } from '../utils/audio';
import getErrorMessage from '../utils/getErrorMessage';

const STATUS_TEXT = {
  idle: '等待开始',
  acquiring_media: '正在请求麦克风…',
  recording: '录音中',
  paused: '已暂停',
  stopping: '正在停止…',
  stopped: '录音完成',
};

const RECORDER_ERROR_TEXT = {
  permission_denied: '麦克风权限被拒绝。请允许浏览器使用麦克风后重试。',
  no_specified_media_found: '没有检测到麦克风设备，请连接麦克风后重试。',
  media_in_use: '麦克风正被其他应用占用，请关闭占用麦克风的应用后重试。',
  media_aborted: '录音被中断，请重试。',
  invalid_media_constraints: '当前设备不支持所需的录音参数。',
  no_constraints: '当前浏览器不支持录音。',
  recorder_error: '录音器初始化失败，请刷新页面重试。',
};

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatTime(value) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FeynmanRecordPage() {
  const { id } = useParams();

  const [knowledgePoint, setKnowledgePoint] = useState(null);
  const [loadingKp, setLoadingKp] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [transcript, setTranscript] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [attempts, setAttempts] = useState([]);
  const [attemptsError, setAttemptsError] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedTranscript, setSavedTranscript] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const [elapsed, setElapsed] = useState(0);
  const stopHandlerRef = useRef(null);

  const { status, error, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } =
    useReactMediaRecorder({
      audio: true,
      onStop: (blobUrl, blob) => {
        // 通过 ref 调用最新的处理函数，避免闭包拿到旧的 state。
        stopHandlerRef.current?.(blob);
      },
    });

  // 录音计时
  useEffect(() => {
    if (status !== 'recording') return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.get(`/knowledge-points/${id}`);
        if (!cancelled) setKnowledgePoint(response.data);
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err, '加载知识点失败'));
      } finally {
        if (!cancelled) setLoadingKp(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadAttempts = useCallback(async () => {
    try {
      const response = await apiClient.get(`/knowledge-points/${id}/attempts`);
      setAttempts(response.data);
      setAttemptsError('');
    } catch (err) {
      setAttemptsError(getErrorMessage(err, '加载复述记录失败'));
    }
  }, [id]);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  // 停止录音后：转换为 16kHz WAV，上传到后端转录。
  const uploadRecording = useCallback(
    async (blob) => {
      if (!blob) return;
      setIsUploading(true);
      setUploadError('');
      setTranscript('');
      setSavedTranscript('');
      setSaveMessage('');
      setSaveError('');

      try {
        const wavFile = await blobToWavFile(blob, `feynman-${id}.wav`);
        const formData = new FormData();
        formData.append('audio', wavFile);

        const response = await apiClient.post('/audio/transcribe', formData, {
          // 实例默认是 application/json，上传 FormData 时必须显式声明 multipart，
          // 浏览器会自动补上 boundary。
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setTranscript(response.data.result || '');
        if (!response.data.result) {
          setUploadError('识别结果为空，请再录一次或手动输入文字。');
        }
      } catch (err) {
        setUploadError(getErrorMessage(err, '上传或转录失败，请重试'));
      } finally {
        setIsUploading(false);
      }
    },
    [id],
  );

  // 保存最新的上传处理函数，供录音结束回调使用（避免渲染期间写 ref）
  useEffect(() => {
    stopHandlerRef.current = uploadRecording;
  }, [uploadRecording]);

  const handleStart = () => {
    setTranscript('');
    setUploadError('');
    setSavedTranscript('');
    setSaveMessage('');
    setSaveError('');
    setElapsed(0);
    if (mediaBlobUrl) clearBlobUrl();
    startRecording();
  };

  const handleReset = () => {
    clearBlobUrl();
    setTranscript('');
    setUploadError('');
    setSavedTranscript('');
    setSaveMessage('');
    setSaveError('');
    setElapsed(0);
  };

  const handleSave = async () => {
    const text = transcript.trim();
    if (!text) return;

    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      await apiClient.post(`/knowledge-points/${id}/attempts`, { transcript: text });
      setSavedTranscript(text);
      setSaveMessage('复述已保存到复述记录。');
      await loadAttempts();
    } catch (err) {
      setSaveError(getErrorMessage(err, '保存复述失败，请重试'));
    } finally {
      setSaving(false);
    }
  };

  if (loadingKp) {
    return (
      <div className="page-heading">
        <h1>复述知识点</h1>
        <p className="muted">加载中…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="state-panel state-error">
        <p>{loadError}</p>
        <Link to="/" className="btn btn-secondary btn-sm">
          返回列表
        </Link>
      </div>
    );
  }

  const recorderErrorText = error ? RECORDER_ERROR_TEXT[error] || `录音出错：${error}` : '';
  const isRecording = status === 'recording';
  const isBusy = status === 'acquiring_media' || isUploading;
  const canSave = transcript.trim().length > 0 && transcript.trim() !== savedTranscript;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            <Link to="/">← 返回知识点列表</Link>
          </p>
          <h1>复述知识点</h1>
          <p className="muted">用麦克风把理解讲出来，AI 会把语音转成文字。</p>
        </div>
      </div>

      <div className="record-layout">
        <div className="record-main">
          <section className="kp-summary">
            <div className="kp-title-row">
              <h2>{knowledgePoint?.title}</h2>
            </div>
            <div className="kp-content">
              <MarkdownRenderer>{knowledgePoint?.content}</MarkdownRenderer>
            </div>
          </section>

          <section className="record-card">
            <div className="record-card-header">
              <h2>录音</h2>
              <span className={`record-status ${isRecording ? 'is-recording' : ''}`}>
                <span className="record-dot" />
                {STATUS_TEXT[status] || status}
                {isRecording && <strong className="record-timer">{formatDuration(elapsed)}</strong>}
              </span>
            </div>

            <p className="record-hint">
              点击“开始录音”，对着麦克风用自己的话复述上面的知识点，停止后会自动上传识别。
              录音需要浏览器授权麦克风，并且页面运行在 <code>localhost</code> 或 HTTPS 下。
              百度短语音识别单次限制约 60 秒，内容较长时请分段录制。
            </p>

            {(recorderErrorText || error) && (
              <p className="form-error" role="alert">
                {recorderErrorText || RECORDER_ERROR_TEXT[error] || '录音出错'}
              </p>
            )}

            <div className="record-actions">
              {isRecording ? (
                <button type="button" className="btn btn-danger" onClick={stopRecording}>
                  停止录音
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={handleStart} disabled={isBusy}>
                  {status === 'acquiring_media' ? '正在请求麦克风…' : '开始录音'}
                </button>
              )}

              {mediaBlobUrl && !isRecording && (
                <button type="button" className="link-button" onClick={handleReset}>
                  重新录制
                </button>
              )}
            </div>

            {mediaBlobUrl && (
              <audio className="record-audio" src={mediaBlobUrl} controls>
                你的浏览器不支持音频播放。
              </audio>
            )}
          </section>

          <section className="record-card">
            <div className="record-card-header">
              <h2>AI 转录结果</h2>
              {isUploading && <span className="record-status">正在识别…</span>}
            </div>

            {isUploading && (
              <p className="record-hint">正在上传音频并调用百度语音识别，请稍候…</p>
            )}

            {uploadError && (
              <p className="form-error" role="alert">
                {uploadError}
              </p>
            )}

            <textarea
              className="transcript-textarea"
              value={transcript}
              onChange={(event) => {
                setTranscript(event.target.value);
                setSaveMessage('');
              }}
              placeholder="录音完成后，转录文字会显示在这里；你也可以直接手动输入或修改。"
              rows={7}
            />

            <div className="record-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!canSave || saving}
              >
                {saving ? '保存中…' : savedTranscript && !canSave ? '已保存' : '保存复述'}
              </button>
            </div>

            {saveMessage && <p className="form-notice">{saveMessage}</p>}
            {saveError && (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            )}
          </section>
        </div>

        <aside className="record-side">
          <section className="record-card">
            <div className="record-card-header">
              <h2>复述记录</h2>
              <span className="muted">{attempts.length} 条</span>
            </div>

            {attemptsError && (
              <p className="form-error" role="alert">
                {attemptsError}
              </p>
            )}

            {!attemptsError && attempts.length === 0 && (
              <p className="muted">还没有保存过复述。录一段并保存，记录会出现在这里。</p>
            )}

            {attempts.length > 0 && (
              <ul className="attempt-list">
                {attempts.map((attempt) => (
                  <li className="attempt-item" key={attempt._id}>
                    <p className="attempt-text">{attempt.transcript}</p>
                    <p className="attempt-time">{formatTime(attempt.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default FeynmanRecordPage;
