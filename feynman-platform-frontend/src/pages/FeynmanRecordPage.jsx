// src/pages/FeynmanRecordPage.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReactMediaRecorder } from 'react-media-recorder';
import apiClient from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { blobToWavFile } from '../utils/audio';
import getErrorMessage from '../utils/getErrorMessage';
import {
  RECORDER_STATUS_TEXT,
  formatDuration,
  getRecorderErrorText,
} from '../utils/recorder';

function formatTime(value) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 分数配色：80 分以上绿色，60 分以上橙色，其余红色。
function getScoreTone(score) {
  if (typeof score !== 'number') return '';
  if (score >= 80) return 'is-good';
  if (score >= 60) return 'is-ok';
  return 'is-poor';
}

function FeynmanRecordPage() {
  const { id } = useParams();

  const [knowledgePoint, setKnowledgePoint] = useState(null);
  const [loadingKp, setLoadingKp] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [transcript, setTranscript] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [aiFeedback, setAiFeedback] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiError, setAiError] = useState('');
  // 用递增序号丢弃过期请求：重新录音/重新评价时，旧响应不再覆盖新结果。
  const evaluationSeqRef = useRef(0);

  const [attempts, setAttempts] = useState([]);
  const [attemptsError, setAttemptsError] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedTranscript, setSavedTranscript] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const [elapsed, setElapsed] = useState(0);
  const stopHandlerRef = useRef(null);
  // 暂停会让计时 effect 重启，因此按「录音中」的片段累计时长。
  const accumulatedMsRef = useRef(0);
  const runningSinceRef = useRef(null);

  const {
    status,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    mediaBlobUrl,
    clearBlobUrl,
  } = useReactMediaRecorder({
    audio: true,
    onStop: (blobUrl, blob) => {
      // 通过 ref 调用最新的处理函数，避免闭包拿到旧的 state。
      stopHandlerRef.current?.(blob);
    },
  });

  // 录音计时（暂停期间不计时）
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

  // 把转录文本交给 DeepSeek：润色 + 评价 + 打分。
  // 后端会根据分数自动维护知识点的 reviewList（低于阈值加入复习列表）。
  const evaluateTranscript = useCallback(
    async (text) => {
      const content = typeof text === 'string' ? text.trim() : '';
      if (!content) return;

      const seq = ++evaluationSeqRef.current;
      setIsEvaluating(true);
      setAiError('');
      setAiFeedback(null);

      try {
        const response = await apiClient.post('/ai/evaluate', {
          originalContent: knowledgePoint?.content || '',
          transcribedText: content,
          knowledgePointId: id,
        });
        if (evaluationSeqRef.current !== seq) return;
        // sourceText 用来判断评价是否还对应输入框里的最新文字。
        setAiFeedback({ ...response.data, sourceText: content });
      } catch (err) {
        if (evaluationSeqRef.current !== seq) return;
        setAiError(getErrorMessage(err, 'AI 评价失败，请稍后重试'));
      } finally {
        if (evaluationSeqRef.current === seq) setIsEvaluating(false);
      }
    },
    [id, knowledgePoint],
  );

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
      setAiFeedback(null);
      setAiError('');

      try {
        const wavFile = await blobToWavFile(blob, `feynman-${id}.wav`);
        const formData = new FormData();
        formData.append('audio', wavFile);

        const response = await apiClient.post('/audio/transcribe', formData, {
          // 实例默认是 application/json，上传 FormData 时必须显式声明 multipart，
          // 浏览器会自动补上 boundary。
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const result = response.data.result || '';
        setTranscript(result);
        if (result) {
          // 转录成功后自动让 AI 教练批阅。
          evaluateTranscript(result);
        } else {
          setUploadError('识别结果为空，请再录一次或手动输入文字。');
        }
      } catch (err) {
        setUploadError(getErrorMessage(err, '上传或转录失败，请重试'));
      } finally {
        setIsUploading(false);
      }
    },
    [evaluateTranscript, id],
  );

  // 保存最新的上传处理函数，供录音结束回调使用（避免渲染期间写 ref）
  useEffect(() => {
    stopHandlerRef.current = uploadRecording;
  }, [uploadRecording]);

  const resetAiState = () => {
    // 让进行中的评价请求失效，避免旧结果写回页面。
    evaluationSeqRef.current += 1;
    setAiFeedback(null);
    setAiError('');
    setIsEvaluating(false);
  };

  const handleStart = () => {
    setTranscript('');
    setUploadError('');
    setSavedTranscript('');
    setSaveMessage('');
    setSaveError('');
    accumulatedMsRef.current = 0;
    runningSinceRef.current = null;
    setElapsed(0);
    resetAiState();
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
    accumulatedMsRef.current = 0;
    runningSinceRef.current = null;
    setElapsed(0);
    resetAiState();
  };

  const handleSave = async () => {
    const text = transcript.trim();
    if (!text) return;

    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      // 只有评价对应的仍是当前文本时，才一并保存 AI 结果，
      // 避免用户改过转录后把旧评价写进历史记录。
      const feedback = aiFeedback?.sourceText === text ? aiFeedback : null;
      const payload = { transcript: text };
      if (feedback) {
        Object.assign(payload, {
          polishedText: feedback.polishedText,
          evaluation: feedback.evaluation,
          strengths: feedback.strengths,
          weaknesses: feedback.weaknesses,
          score: feedback.score,
        });
      }

      await apiClient.post(`/knowledge-points/${id}/attempts`, payload);
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

  const recorderErrorText = getRecorderErrorText(error);
  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isBusy = status === 'acquiring_media' || isUploading;
  const canSave = transcript.trim().length > 0 && transcript.trim() !== savedTranscript;
  // 当前输入框里的文字是否正好对应这份 AI 反馈。
  const hasCurrentFeedback = Boolean(
    aiFeedback && aiFeedback.sourceText === transcript.trim(),
  );

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
              <span
                className={`record-status ${isRecording ? 'is-recording' : ''} ${
                  isPaused ? 'is-paused' : ''
                }`.trim()}
              >
                <span className="record-dot" />
                {RECORDER_STATUS_TEXT[status] || status}
                {(isRecording || isPaused) && (
                  <strong className="record-timer">{formatDuration(elapsed)}</strong>
                )}
              </span>
            </div>

            <p className="record-hint">
              点击“开始录音”，对着麦克风用自己的话复述上面的知识点；录音中可以暂停、继续，
              停止后会自动上传识别，并可以在下方回放录音。
              录音需要浏览器授权麦克风，并且页面运行在 <code>localhost</code> 或 HTTPS 下。
              百度短语音识别单次限制约 60 秒，内容较长时请分段录制。
            </p>

            {recorderErrorText && (
              <p className="form-error" role="alert">
                {recorderErrorText}
              </p>
            )}

            <div className="record-actions">
              {isRecording && (
                <button type="button" className="btn btn-secondary" onClick={pauseRecording}>
                  暂停录音
                </button>
              )}

              {isPaused && (
                <button type="button" className="btn btn-primary" onClick={resumeRecording}>
                  继续录音
                </button>
              )}

              {!isRecording && !isPaused && (
                <button type="button" className="btn btn-primary" onClick={handleStart} disabled={isBusy}>
                  {status === 'acquiring_media' ? '正在请求麦克风…' : '开始录音'}
                </button>
              )}

              {(isRecording || isPaused) && (
                <button type="button" className="btn btn-danger" onClick={stopRecording}>
                  停止录音
                </button>
              )}

              {mediaBlobUrl && !isRecording && !isPaused && (
                <button type="button" className="link-button" onClick={handleReset}>
                  重新录制
                </button>
              )}
            </div>

            {mediaBlobUrl && !isRecording && !isPaused && (
              <div className="record-playback">
                <p className="record-playback-label">回放录音</p>
                <audio className="record-audio" src={mediaBlobUrl} controls>
                  你的浏览器不支持音频播放。
                </audio>
              </div>
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

          <section className="record-card">
            <div className="record-card-header">
              <h2>AI 教练反馈</h2>
              {isEvaluating && <span className="record-status">正在批阅…</span>}
              {!isEvaluating && transcript.trim() && !hasCurrentFeedback && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => evaluateTranscript(transcript)}
                >
                  {aiFeedback ? '重新评价' : 'AI 评价'}
                </button>
              )}
            </div>

            {isEvaluating && (
              <p className="record-hint">AI 教练正在批阅你的复述，通常需要几秒钟…</p>
            )}

            {aiError && (
              <div className="ai-error-row">
                <p className="form-error" role="alert">
                  {aiError}
                </p>
                {transcript.trim() && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => evaluateTranscript(transcript)}
                  >
                    重试
                  </button>
                )}
              </div>
            )}

            {!isEvaluating && !aiError && !aiFeedback && (
              <p className="muted">
                录音转录完成后会自动请求 AI 评价；你也可以手动输入文字后点击“AI 评价”。
              </p>
            )}

            {aiFeedback && !hasCurrentFeedback && (
              <p className="form-notice">
                转录文字已修改，下面的反馈对应修改前的内容。点击“重新评价”可获取新反馈。
              </p>
            )}

            {aiFeedback && (
              <div className="ai-feedback">
                <div className="ai-feedback-main">
                  <section className="ai-block">
                    <h3>润色后的文本</h3>
                    {aiFeedback.polishedText ? (
                      <div className="ai-polished">
                        <MarkdownRenderer>{aiFeedback.polishedText}</MarkdownRenderer>
                      </div>
                    ) : (
                      <p className="muted">AI 未返回润色文本。</p>
                    )}
                  </section>

                  <section className="ai-block">
                    <h3>综合评价</h3>
                    <p className="ai-evaluation">
                      {aiFeedback.evaluation || 'AI 未返回综合评价。'}
                    </p>
                  </section>

                  <div className="ai-points">
                    <section className="ai-block">
                      <h3>优点</h3>
                      {aiFeedback.strengths?.length ? (
                        <ul className="ai-point-list ai-point-strengths">
                          {aiFeedback.strengths.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">暂无</p>
                      )}
                    </section>

                    <section className="ai-block">
                      <h3>待改进</h3>
                      {aiFeedback.weaknesses?.length ? (
                        <ul className="ai-point-list ai-point-weaknesses">
                          {aiFeedback.weaknesses.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">暂无</p>
                      )}
                    </section>
                  </div>
                </div>

                <aside className="ai-score">
                  <p className="ai-score-label">综合得分</p>
                  <p className={`ai-score-value ${getScoreTone(aiFeedback.score)}`}>
                    {aiFeedback.score}
                  </p>
                  <p className="ai-score-max">满分 100</p>
                  {aiFeedback.reviewList !== null && aiFeedback.reviewList !== undefined && (
                    <p
                      className={`ai-review-flag ${aiFeedback.reviewList ? 'is-review' : ''}`}
                    >
                      {aiFeedback.reviewList
                        ? `低于 ${aiFeedback.reviewThreshold} 分，已加入复习列表`
                        : '已达标，移出复习列表'}
                    </p>
                  )}
                </aside>
              </div>
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
                    <div className="attempt-header">
                      <p className="attempt-text">{attempt.transcript}</p>
                      {typeof attempt.score === 'number' && (
                        <span
                          className={`attempt-score ${getScoreTone(attempt.score)}`}
                          title="AI 综合得分"
                        >
                          {attempt.score} 分
                        </span>
                      )}
                    </div>
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
