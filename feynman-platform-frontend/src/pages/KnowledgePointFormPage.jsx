// src/pages/KnowledgePointFormPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axios';
import MarkdownEditor from '../components/MarkdownEditor';
import getErrorMessage from '../utils/getErrorMessage';

const STATUS_OPTIONS = [
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
];

const SAMPLE_CONTENT = [
  '## 牛顿第二定律',
  '',
  '物体加速度的大小跟作用力成正比，跟物体的质量成反比：',
  '',
  '$$F = ma$$',
  '',
  '| 物理量 | 符号 | 单位 |',
  '| --- | --- | --- |',
  '| 力 | F | N |',
  '| 质量 | m | kg |',
  '| 加速度 | a | m/s² |',
  '',
  '```mermaid',
  'graph TD',
  '  A[合外力] --> B[产生加速度]',
  '  B --> C[速度发生变化]',
  '```',
  '',
  '> 用自己的话复述一遍，比反复阅读更有效。',
].join('\n');

function KnowledgePointFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('not_started');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditing) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.get(`/knowledge-points/${id}`);
        if (cancelled) return;
        setTitle(response.data.title || '');
        setContent(response.data.content || '');
        setStatus(response.data.status || 'not_started');
        setError('');
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, '加载知识点失败'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('请填写标题');
      return;
    }
    if (!content.trim()) {
      setError('请填写内容');
      return;
    }

    setSaving(true);
    try {
      const payload = { title: title.trim(), content, status };
      if (isEditing) {
        await apiClient.put(`/knowledge-points/${id}`, payload);
      } else {
        await apiClient.post('/knowledge-points', payload);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, '保存失败，请稍后再试'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-heading">
        <h1>编辑知识点</h1>
        <p className="muted">加载中…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{isEditing ? '编辑知识点' : '新建知识点'}</h1>
          <p className="muted">
            用 Markdown 记录，用公式和图表讲清楚。保存后会出现在你的知识点列表中。
          </p>
        </div>
        <Link to="/" className="btn btn-secondary">
          返回列表
        </Link>
      </div>

      <form className="kp-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-field form-field-grow">
            <span>标题</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：牛顿第二定律"
              maxLength={120}
              required
            />
          </label>

          <label className="form-field">
            <span>学习状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <div className="field-label-row">
            <span>内容</span>
            {!isEditing && (
              <button
                type="button"
                className="link-button"
                onClick={() => setContent(SAMPLE_CONTENT)}
              >
                填充示例内容
              </button>
            )}
          </div>
          <MarkdownEditor value={content} onChange={setContent} minHeight={420} />
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中…' : isEditing ? '保存修改' : '创建知识点'}
          </button>
        </div>
      </form>
    </>
  );
}

export default KnowledgePointFormPage;
