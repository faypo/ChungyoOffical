import React from 'react';

// 解析答案文字中的 [文字](網址) 和 ![alt](網址) 語法
export function parseAnswer(text) {
  const parts = [];
  const regex = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[1] === '!') {
      parts.push({ type: 'image', alt: match[2], url: match[3] });
    } else {
      parts.push({ type: 'link', text: match[2], url: match[3] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return parts;
}

// 渲染答案（支援圖片、超連結、換行）
export function AnswerText({ text, className }) {
  const parts = parseAnswer(text || '');
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.type === 'image') {
          return (
            <img
              key={i}
              src={p.url}
              alt={p.alt || ''}
              style={{ maxWidth: '100%', display: 'block', margin: '6px 0', borderRadius: '6px' }}
            />
          );
        }
        if (p.type === 'link') {
          return (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">{p.text}</a>
          );
        }
        return (
          <React.Fragment key={i}>
            {p.content.split('\n').map((line, j, arr) => (
              <React.Fragment key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}
    </span>
  );
}
