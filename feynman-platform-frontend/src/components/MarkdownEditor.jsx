// src/components/MarkdownEditor.jsx
import { useRef, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

const TOOLBAR_GROUPS = [
  [
    { label: 'H2', title: '标题', before: '## ', placeholder: '标题' },
    { label: 'B', title: '加粗', className: 'tool-bold', before: '**', after: '**', placeholder: '加粗文字' },
    { label: 'I', title: '斜体', className: 'tool-italic', before: '*', after: '*', placeholder: '斜体文字' },
    { label: '</>', title: '行内代码', before: '`', after: '`', placeholder: '代码' },
  ],
  [
    { label: '列表', title: '无序列表', before: '- ', placeholder: '列表项' },
    { label: '引用', title: '引用', before: '> ', placeholder: '引用内容' },
    { label: '链接', title: '链接', before: '[', after: '](https://)', placeholder: '链接文字' },
    {
      label: '表格',
      title: '表格',
      before: '\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 1 | 内容 2 |\n',
      placeholder: '',
    },
  ],
  [
    { label: 'x²', title: '行内公式', before: '$', after: '$', placeholder: 'E = mc^2' },
    {
      label: 'Σ',
      title: '块级公式',
      before: '\n$$\n',
      after: '\n$$\n',
      placeholder: '\\int_a^b f(x) dx = F(b) - F(a)',
    },
    {
      label: '流程图',
      title: 'Mermaid 流程图',
      before: '\n```mermaid\ngraph TD\n  A[开始] --> B[结束]\n```\n',
      placeholder: '',
    },
  ],
];

const MODES = [
  { key: 'edit', label: '编辑' },
  { key: 'split', label: '分栏' },
  { key: 'preview', label: '预览' },
];

function MarkdownEditor({ value, onChange, placeholder = '在这里输入 Markdown 内容…', minHeight = 360 }) {
  const [mode, setMode] = useState('split');
  const textareaRef = useRef(null);

  // 把语法片段插入到光标处；如果选中了文字，就用语法包裹这段文字。
  const insertSnippet = ({ before, after = '', placeholder: snippetPlaceholder = '' }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || snippetPlaceholder;
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);

    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorStart = start + before.length;
      textarea.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  };

  const handleKeyDown = (event) => {
    // 在文本域里按 Tab 时插入两个空格，而不是把焦点移走。
    if (event.key === 'Tab') {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      onChange(value.slice(0, start) + '  ' + value.slice(end));
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        <div className="md-toolbar-groups">
          {TOOLBAR_GROUPS.map((group, groupIndex) => (
            <div className="md-toolbar-group" key={groupIndex}>
              {group.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`md-tool ${item.className || ''}`.trim()}
                  title={item.title}
                  aria-label={item.title}
                  onClick={() => insertSnippet(item)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="md-mode-switch" role="group" aria-label="编辑器模式">
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={mode === item.key ? 'is-active' : ''}
              onClick={() => setMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`md-body md-body-${mode}`} style={{ '--editor-min-height': `${minHeight}px` }}>
        {mode !== 'preview' && (
          <textarea
            ref={textareaRef}
            className="md-textarea"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            spellCheck={false}
          />
        )}

        {mode !== 'edit' && (
          <div className="md-preview">
            {value.trim() ? (
              <MarkdownRenderer>{value}</MarkdownRenderer>
            ) : (
              <p className="md-preview-empty">左侧输入内容后，这里会实时预览渲染效果。</p>
            )}
          </div>
        )}
      </div>

      <p className="md-hint">
        支持 Markdown、GFM 表格、<code>$行内公式$</code>、<code>$$块级公式$$</code> 和
        <code>```mermaid</code> 流程图。
      </p>
    </div>
  );
}

export default MarkdownEditor;
