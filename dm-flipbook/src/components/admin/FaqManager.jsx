import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { AnswerText } from '../../utils/faqAnswer';
import './FaqManager.css';

const API = '/api/admin/faq';

const EMPTY_FORM = { question: '', answer: '', keywords: '', is_active: true };

export default function FaqManager() {
  const [tree,        setTree]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [msg,         setMsg]         = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [expanded,    setExpanded]    = useState({});
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [mode,        setMode]        = useState(null);
  const [newParentId, setNewParentId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // 超連結插入
  const textareaRef     = useRef(null);
  const [linkPopup,     setLinkPopup]     = useState(false);
  const [linkUrl,       setLinkUrl]       = useState('');
  const [savedSel,      setSavedSel]      = useState(null);
  const linkUrlRef      = useRef(null);

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = useCallback(async () => {
    const r = await apiFetch(API);
    const d = await r.json();
    setTree(Array.isArray(d) ? d : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function findNode(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNode(n.children || [], id);
      if (found) return found;
    }
    return null;
  }

  function getSiblings(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return nodes;
      const found = getSiblings(n.children || [], id);
      if (found) return found;
    }
    return null;
  }

  const handleSelect = (node) => {
    setSelected(node.id);
    setForm({ question: node.question, answer: node.answer, keywords: node.keywords ?? '', is_active: node.is_active });
    setMode('edit');
    setNewParentId(null);
    setLinkPopup(false);
  };

  const handleNewRoot = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setMode('new-root');
    setNewParentId(null);
    setLinkPopup(false);
  };

  const handleNewChild = (parentNode) => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setMode('new-child');
    setNewParentId(parentNode.id);
    setLinkPopup(false);
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── 超連結工具列 ──
  const handleLinkBtn = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    setSavedSel({ start: ta.selectionStart, end: ta.selectionEnd });
    setLinkUrl('');
    setLinkPopup(true);
    setTimeout(() => linkUrlRef.current?.focus(), 50);
  };

  const handleInsertLink = () => {
    const url = linkUrl.trim();
    if (!url) { setLinkPopup(false); return; }
    const ta   = textareaRef.current;
    const { start, end } = savedSel;
    const text     = form.answer;
    const selected = text.slice(start, end).trim() || '連結文字';
    const insertion = `[${selected}](${url})`;
    const newText   = text.slice(0, start) + insertion + text.slice(end);
    setForm(f => ({ ...f, answer: newText }));
    setLinkPopup(false);
    setLinkUrl('');
    setTimeout(() => {
      ta.focus();
      const pos = start + insertion.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      showMsg('問題與答案為必填', 'err');
      return;
    }
    setSaving(true);
    if (mode === 'edit') {
      const res = await apiFetch(`${API}/${selected}`, {
        method: 'PUT',
        body: JSON.stringify({
          question:  form.question.trim(),
          answer:    form.answer.trim(),
          keywords:  form.keywords.trim() || null,
          is_active: form.is_active,
        }),
      });
      if (res.ok) { showMsg('已儲存'); await load(); }
      else showMsg('儲存失敗', 'err');
    } else {
      const res = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({
          parent_id:  newParentId ?? null,
          question:   form.question.trim(),
          answer:     form.answer.trim(),
          keywords:   form.keywords.trim() || null,
          sort_order: 0,
        }),
      });
      if (res.ok) {
        const node = await res.json();
        showMsg('已新增');
        setMode('edit');
        setSelected(node.id);
        setForm({ question: node.question, answer: node.answer, keywords: node.keywords ?? '', is_active: node.is_active });
        if (newParentId) setExpanded(prev => ({ ...prev, [newParentId]: true }));
        await load();
      } else showMsg('新增失敗', 'err');
    }
    setSaving(false);
  };

  const handleDelete = async (node) => {
    const hasChildren = (node.children || []).length > 0;
    const confirmMsg = hasChildren
      ? `刪除「${node.question}」將同時刪除其下所有子問題，確定嗎？`
      : `確定刪除「${node.question}」？`;
    if (!window.confirm(confirmMsg)) return;
    await apiFetch(`${API}/${node.id}`, { method: 'DELETE' });
    if (selected === node.id) { setSelected(null); setMode(null); }
    showMsg('已刪除');
    await load();
  };

  const handleMove = async (node, dir) => {
    const siblings = getSiblings(tree, node.id);
    if (!siblings) return;
    const idx     = siblings.findIndex(n => n.id === node.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const items = siblings.map((n, i) => {
      if (i === idx)     return { id: n.id, sort_order: siblings[swapIdx].sort_order };
      if (i === swapIdx) return { id: n.id, sort_order: siblings[idx].sort_order };
      return { id: n.id, sort_order: n.sort_order };
    });
    await apiFetch(`${API}/reorder`, { method: 'PUT', body: JSON.stringify(items) });
    await load();
  };

  function renderNode(node, depth = 0) {
    const hasChildren = (node.children || []).length > 0;
    const isOpen      = expanded[node.id];
    const isSelected  = selected === node.id;

    return (
      <div key={node.id} className="faq-tree-node">
        <div
          className={`faq-tree-row${isSelected ? ' faq-tree-row--selected' : ''}${!node.is_active ? ' faq-tree-row--inactive' : ''}`}
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          <button
            className="faq-tree-toggle"
            onClick={() => hasChildren && toggleExpand(node.id)}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            {isOpen ? '▾' : '▸'}
          </button>
          <span className="faq-tree-label" onClick={() => handleSelect(node)}>
            {node.question}
          </span>
          <div className="faq-tree-actions">
            <button className="faq-icon-btn" title="上移"  onClick={() => handleMove(node, 'up')}>↑</button>
            <button className="faq-icon-btn" title="下移"  onClick={() => handleMove(node, 'down')}>↓</button>
            <button className="faq-icon-btn faq-icon-btn--add" title="新增子問題"
              onClick={() => { handleNewChild(node); setExpanded(prev => ({ ...prev, [node.id]: true })); }}>＋</button>
            <button className="faq-icon-btn faq-icon-btn--del" title="刪除"
              onClick={() => handleDelete(node)}>✕</button>
          </div>
        </div>
        {hasChildren && isOpen && (
          <div className="faq-tree-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <p className="fg-loading">載入中…</p>;

  return (
    <div className="fg-manager faq-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">FAQ 管理</h1>
        <button className="fg-btn fg-btn-primary" onClick={handleNewRoot}>＋ 新增根問題</button>
      </div>

      {msg && (
        <div className="admin-popup-overlay">
          <div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div>
        </div>
      )}

      <div className="faq-layout">
        {/* ── 左側樹 ── */}
        <div className="faq-tree-panel">
          <div className="faq-tree-header">問題結構</div>
          {tree.length === 0 ? (
            <div className="faq-tree-empty">尚無問題，點右上角「新增根問題」開始</div>
          ) : (
            tree.map(node => renderNode(node))
          )}
        </div>

        {/* ── 右側表單 ── */}
        <div className="faq-form-panel">
          {!mode ? (
            <div className="faq-form-empty">← 選擇左側問題編輯，或新增根問題</div>
          ) : (
            <>
              <div className="faq-form-title">
                {mode === 'edit' ? '編輯問題' : mode === 'new-child' ? '新增子問題' : '新增根問題'}
              </div>

              {mode === 'new-child' && newParentId && (
                <div className="faq-form-parent-hint">
                  上層：{findNode(tree, newParentId)?.question}
                </div>
              )}

              <label className="faq-label">問題 <span className="faq-required">*</span></label>
              <input
                className="faq-input"
                value={form.question}
                onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                placeholder="輸入問題"
              />

              {/* ── 答案欄位 + 工具列 ── */}
              <div className="faq-answer-header">
                <label className="faq-label" style={{ margin: 0 }}>
                  答案 <span className="faq-required">*</span>
                </label>
                <div className="faq-toolbar">
                  <button
                    type="button"
                    className="faq-toolbar-btn"
                    onClick={handleLinkBtn}
                    title="反白文字後點此插入超連結"
                  >
                    🔗 加入連結
                  </button>
                  <button
                    type="button"
                    className={`faq-toolbar-btn${showPreview ? ' faq-toolbar-btn--active' : ''}`}
                    onClick={() => setShowPreview(v => !v)}
                  >
                    {showPreview ? '隱藏預覽' : '顯示預覽'}
                  </button>
                </div>
              </div>

              {/* 連結輸入浮層 */}
              {linkPopup && (
                <div className="faq-link-popup">
                  <input
                    ref={linkUrlRef}
                    className="faq-link-input"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="輸入網址，例：/service 或 https://..."
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleInsertLink();
                      if (e.key === 'Escape') setLinkPopup(false);
                    }}
                  />
                  <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleInsertLink}>插入</button>
                  <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setLinkPopup(false)}>取消</button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="faq-textarea"
                value={form.answer}
                onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                placeholder="輸入答案內容"
                rows={5}
              />

              {showPreview && form.answer && (
                <div className="faq-preview">
                  <div className="faq-preview-label">預覽</div>
                  <div className="faq-preview-body">
                    <AnswerText text={form.answer} />
                  </div>
                </div>
              )}

              <label className="faq-label">
                關鍵字
                <span className="faq-hint">（用空格分隔，用於搜尋比對）</span>
              </label>
              <input
                className="faq-input"
                value={form.keywords}
                onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                placeholder="例：退換貨 退款 發票"
              />

              {mode === 'edit' && (
                <label className="faq-toggle-row">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  />
                  <span>啟用此問題</span>
                </label>
              )}

              <div className="faq-form-actions">
                <button className="fg-btn fg-btn-ghost"
                  onClick={() => { setMode(null); setSelected(null); setLinkPopup(false); }}>
                  取消
                </button>
                <button className="fg-btn fg-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
