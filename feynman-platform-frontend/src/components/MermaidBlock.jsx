// src/components/MermaidBlock.jsx
import { useEffect, useId, useState } from 'react';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';

// 全局只需初始化一次。startOnLoad 关闭，因为我们手动调用 render。
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
  suppressErrorRendering: true,
  // 用 SVG 原生 <text> 渲染节点文字（而不是 foreignObject 里的 HTML），
  // 这样 DOMPurify 过滤 SVG 时不会把标签文字一并清掉。
  // 注意：mermaid v12 起 htmlLabels 是顶层配置项。
  htmlLabels: false,
});

let renderCounter = 0;

function MermaidBlock({ code }) {
  const reactId = useId();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}-${renderCounter++}`;

    setError('');
    setSvg('');

    mermaid
      .render(id, code)
      .then(({ svg: rawSvg }) => {
        if (cancelled) return;
        // Mermaid 已启用 strict 安全级别，这里再用 DOMPurify 过滤一层，
        // 防止 SVG 中夹带脚本或事件属性。
        const cleanSvg = DOMPurify.sanitize(rawSvg, {
          USE_PROFILES: { html: true, svg: true, svgFilters: true },
          ADD_TAGS: ['foreignObject'],
          ADD_ATTR: ['dominant-baseline'],
        });
        setSvg(cleanSvg);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || '流程图语法有误');
      });

    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (error) {
    return (
      <div className="mermaid-error">
        <p className="mermaid-error-title">流程图渲染失败</p>
        <pre>{code}</pre>
        <p className="mermaid-error-detail">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return <div className="mermaid-loading">正在渲染流程图…</div>;
  }

  return (
    <div
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default MermaidBlock;
