// src/pages/DashboardPage.jsx
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import getErrorMessage from '../utils/getErrorMessage';

const STATUS_META = {
  not_started: { label: '未开始', className: 'status-todo' },
  in_progress: { label: '学习中', className: 'status-doing' },
  mastered: { label: '已掌握', className: 'status-done' },
};

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DashboardPage() {
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchKnowledgePoints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/knowledge-points');
      setKnowledgePoints(response.data);
    } catch (err) {
      setError(getErrorMessage(err, '获取知识点失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  // 空依赖数组：只在组件首次挂载时请求一次列表。
  useEffect(() => {
    fetchKnowledgePoints();
  }, [fetchKnowledgePoints]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`确定要删除「${title || '这个知识点'}」吗？删除后无法恢复。`)) return;

    setDeletingId(id);
    try {
      await apiClient.delete(`/knowledge-points/${id}`);
      // 本地同步移除，避免整页重新请求。
      setKnowledgePoints((prev) => prev.filter((kp) => kp._id !== id));
    } catch (err) {
      window.alert(getErrorMessage(err, '删除失败，请稍后再试'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-heading">
        <h1>我的知识点</h1>
        <p className="muted">加载中…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>我的知识点</h1>
          <p className="muted">把你学到的内容用自己的话讲清楚，这就是费曼学习法。</p>
        </div>
        <Link to="/kp/new" className="btn btn-primary">
          + 新建知识点
        </Link>
      </div>

      {error && (
        <div className="state-panel state-error">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchKnowledgePoints}>
            重试
          </button>
        </div>
      )}

      {!error && knowledgePoints.length === 0 && (
        <div className="state-panel state-empty">
          <h2>还没有知识点</h2>
          <p>从第一个概念开始，用自己的话把它讲明白。</p>
          <Link to="/kp/new" className="btn btn-primary">
            创建第一个知识点
          </Link>
        </div>
      )}

      {!error && knowledgePoints.length > 0 && (
        <div className="kp-list">
          {knowledgePoints.map((kp) => {
            const status = STATUS_META[kp.status] || STATUS_META.not_started;
            return (
              <article className="kp-card" key={kp._id}>
                <header className="kp-card-header">
                  <div className="kp-title-row">
                    <h2>{kp.title}</h2>
                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="kp-meta">更新于 {formatDate(kp.updatedAt || kp.createdAt)}</p>
                </header>

                <div className="kp-content">
                  <MarkdownRenderer>{kp.content}</MarkdownRenderer>
                </div>

                <footer className="kp-actions">
                  <Link to={`/feynman/${kp._id}`} className="btn btn-primary btn-sm">
                    开始复述
                  </Link>
                  <Link to={`/kp/edit/${kp._id}`} className="btn btn-secondary btn-sm">
                    编辑
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(kp._id, kp.title)}
                    disabled={deletingId === kp._id}
                  >
                    {deletingId === kp._id ? '删除中…' : '删除'}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

export default DashboardPage;
