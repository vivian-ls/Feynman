// src/components/MarkdownRenderer.jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import MermaidBlock from './MermaidBlock';
import 'katex/dist/katex.min.css';

// react-markdown 默认不会执行 Markdown 中的原始 HTML，
// 因此像 <script> 这样的内容不会被渲染，天然规避了大部分 XSS 风险。

function isMermaidBlock(node) {
  const codeNode = node?.children?.find((child) => child.tagName === 'code');
  const className = codeNode?.properties?.className;
  const classes = Array.isArray(className) ? className.join(' ') : className || '';
  return classes.includes('language-mermaid');
}

const components = {
  // 普通代码块仍用 <pre><code>；Mermaid 代码块则直接交给 MermaidBlock 渲染，
  // 避免把 <div> 套进 <pre> 里造成非法结构。
  pre({ node, children }) {
    if (isMermaidBlock(node)) return <>{children}</>;
    return <pre>{children}</pre>;
  },

  code({ className, children, ...props }) {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    if (language === 'mermaid') {
      return <MermaidBlock code={String(children).replace(/\n$/, '')} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },

  a({ children, ...props }) {
    return (
      <a {...props} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },

  table({ children }) {
    return (
      <div className="table-wrapper">
        <table>{children}</table>
      </div>
    );
  },
};

function MarkdownRenderer({ children, className = '' }) {
  return (
    <div className={`markdown-body ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
