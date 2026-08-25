import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as WordCloudModule from 'wordcloud';
import { apiFetch } from '../../utils/apiFetch';
import { AnswerText } from '../../utils/faqAnswer';
import { useModulePermission } from '../../utils/useModulePermission';
import './FaqManager.css';

const WordCloud = WordCloudModule.default ?? WordCloudModule;

const API = '/api/admin/faq';
const EMPTY_FORM = { question: '', answer: '', keywords: '', is_active: true, start_date: '', end_date: '' };

export default function FaqManager() {
  const { canWrite } = useModulePermission('faq');
  const [nodes,    setNodes]    = useState([]);
  const [links,    setLinks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState(null);
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [mode,     setMode]     = useState(null);
  const [nodeSearch, setNodeSearch] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 無法回答時的 fallback 訊息設定
  const [fallbackMsg,     setFallbackMsg]     = useState('');
  const [savingFallback,  setSavingFallback]  = useState(false);

  // AI 知識庫問答
  const [aiEnabled,   setAiEnabled]   = useState(false);
  const [savingAi,    setSavingAi]    = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [syncResult,  setSyncResult]  = useState(null);
  const [showAiSection, setShowAiSection] = useState(false);

  // 客服文件（純文字，附起訖日期，同步進知識庫）
  const [documents,      setDocuments]      = useState([]);
  const [showDocsSection, setShowDocsSection] = useState(false);
  const [docTitle,       setDocTitle]       = useState('');
  const [docStart,       setDocStart]       = useState('');
  const [docEnd,         setDocEnd]         = useState('');
  const [docFile,        setDocFile]        = useState(null);
  const [uploadingDoc,   setUploadingDoc]   = useState(false);
  const docFileRef = useRef(null);

  // 未解答問題清單
  const [unanswered,        setUnanswered]        = useState([]);
  const [showUnanswered,    setShowUnanswered]    = useState(false);
  const [fromUnansweredId,  setFromUnansweredId]  = useState(null); // 建立問題來源的待補充 id

  // 查詢文字雲
  const [showWordCloud,   setShowWordCloud]   = useState(false);
  const [wordCloudWords,  setWordCloudWords]  = useState([]);
  const [wcLoading,       setWcLoading]       = useState(false);
  const [wcError,         setWcError]         = useState('');
  const canvasRef = useRef(null);

  // 工具列
  const textareaRef  = useRef(null);
  const [linkPopup,  setLinkPopup]  = useState(false);
  const [linkUrl,    setLinkUrl]    = useState('');
  const [savedSel,   setSavedSel]   = useState(null);
  const linkUrlRef   = useRef(null);
  const [uploading,  setUploading]  = useState(false);
  const [dragOver,   setDragOver]   = useState(false);

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const loadNodes = useCallback(async () => {
    const r = await apiFetch(API);
    const d = await r.json();
    setNodes(Array.isArray(d) ? d : []);
    setLoading(false);
  }, []);

  const loadLinks = useCallback(async (nodeId) => {
    const r = await apiFetch(`${API}/${nodeId}/links`);
    const d = await r.json();
    setLinks(Array.isArray(d) ? d : []);
  }, []);

  const loadUnanswered = useCallback(async () => {
    const r = await apiFetch(`${API}/unanswered`);
    const d = await r.json();
    setUnanswered(Array.isArray(d) ? d : []);
  }, []);

  const loadDocuments = useCallback(async () => {
    const r = await apiFetch(`${API}/documents`);
    const d = await r.json();
    setDocuments(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => {
    loadNodes();
    apiFetch(`${API}/config`).then(r => r.json()).then(d => setFallbackMsg(d.fallback_message ?? '')).catch(() => {});
    apiFetch(`${API}/ai-config`).then(r => r.json()).then(d => setAiEnabled(!!d.enabled)).catch(() => {});
    loadUnanswered();
    loadDocuments();
  }, [loadNodes, loadUnanswered, loadDocuments]);

  const loadWordCloud = useCallback(async () => {
    setWcLoading(true);
    setWcError('');
    try {
      const r = await apiFetch(`${API}/wordcloud`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setWordCloudWords(Array.isArray(d) ? d : []);
    } catch (e) {
      setWcError(`載入失敗：${e.message}`);
    } finally {
      setWcLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showWordCloud || !canvasRef.current || wordCloudWords.length === 0) return;
    if (typeof WordCloud !== 'function') return;
    // 正規化字型大小，最大 60px 最小 14px
    const maxVal = Math.max(...wordCloudWords.map(w => w.value), 1);
    const list = wordCloudWords.map(w => [
      w.text,
      Math.round(14 + (w.value / maxVal) * 46),
    ]);
    WordCloud(canvasRef.current, {
      list,
      gridSize:        8,
      fontFamily:      'sans-serif',
      rotateRatio:     0,
      backgroundColor: '#fafafa',
      color:           () => `hsl(${Math.floor(Math.random() * 220 + 180)},55%,42%)`,
      shrinkToFit:     true,
    });
  }, [showWordCloud, wordCloudWords]);

  const handleDismissUnanswered = async (id) => {
    await apiFetch(`${API}/unanswered/${id}`, { method: 'DELETE' });
    setUnanswered(prev => prev.filter(u => u.id !== id));
  };

  const handleCreateFromUnanswered = (id, query) => {
    setSelected(null);
    setForm({ ...EMPTY_FORM, question: query });
    setMode('new');
    setLinks([]);
    setShowLinkSelector(false);
    setShowPreview(false);
    setFromUnansweredId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveFallback = async () => {
    setSavingFallback(true);
    const r = await apiFetch(`${API}/config`, {
      method: 'PUT',
      body: JSON.stringify({ fallback_message: fallbackMsg }),
    });
    showMsg(r.ok ? '已儲存無法回答訊息' : '儲存失敗', r.ok ? 'ok' : 'err');
    setSavingFallback(false);
  };

  const handleToggleAi = async (checked) => {
    setSavingAi(true);
    const r = await apiFetch(`${API}/ai-config`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: checked }),
    });
    if (r.ok) { setAiEnabled(checked); showMsg(checked ? '已開啟 AI 問答' : '已關閉 AI 問答'); }
    else showMsg('切換失敗', 'err');
    setSavingAi(false);
  };

  const handleSyncKb = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await apiFetch(`${API}/sync-knowledge-base`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '同步失敗');
      setSyncResult({ ok: true, ...d });
      showMsg('知識庫同步完成');
    } catch (e) {
      setSyncResult({ ok: false, error: e.message });
      showMsg('知識庫同步失敗', 'err');
    }
    setSyncing(false);
  };

  // ── 客服文件：上傳 ──
  const handleUploadDoc = async () => {
    if (!docTitle.trim()) return showMsg('文件標題為必填', 'err');
    if (!docFile) return showMsg('請選擇 .txt 文件', 'err');
    setUploadingDoc(true);
    const fd = new FormData();
    fd.append('file', docFile);
    fd.append('title', docTitle.trim());
    fd.append('start_date', docStart);
    fd.append('end_date', docEnd);
    const r = await apiFetch(`${API}/documents/upload`, { method: 'POST', body: fd });
    const d = await r.json();
    setUploadingDoc(false);
    if (!r.ok) return showMsg(d.error || '上傳失敗', 'err');
    showMsg('已上傳，正在背景同步進知識庫（可稍後按「立即同步知識庫」確認結果）');
    setDocTitle(''); setDocStart(''); setDocEnd(''); setDocFile(null);
    if (docFileRef.current) docFileRef.current.value = '';
    await loadDocuments();
  };

  // ── 客服文件：切換啟用狀態 ──
  const handleToggleDocActive = async (doc, checked) => {
    const r = await apiFetch(`${API}/documents/${doc.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: doc.title,
        start_date: doc.start_date ? doc.start_date.slice(0, 10) : '',
        end_date:   doc.end_date   ? doc.end_date.slice(0, 10)   : '',
        is_active:  checked,
      }),
    });
    if (!r.ok) return showMsg('更新失敗', 'err');
    await loadDocuments();
  };

  // ── 客服文件：刪除 ──
  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`確定刪除文件「${doc.title}」？`)) return;
    await apiFetch(`${API}/documents/${doc.id}`, { method: 'DELETE' });
    showMsg('已刪除文件，正在背景同步知識庫');
    await loadDocuments();
  };

  // ── 節點選取 / 新增 ──
  const handleSelect = (node) => {
    setSelected(node.id);
    setForm({
      question:   node.question,
      answer:     node.answer,
      keywords:   node.keywords ?? '',
      is_active:  node.is_active,
      start_date: node.start_date ? node.start_date.slice(0, 16) : '',
      end_date:   node.end_date   ? node.end_date.slice(0, 16)   : '',
    });
    setMode('edit');
    setShowLinkSelector(false);
    setShowPreview(false);
    setLinkSearch('');
    setFromUnansweredId(null);
    loadLinks(node.id);
  };

  const handleNew = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setMode('new');
    setLinks([]);
    setShowLinkSelector(false);
    setShowPreview(false);
    setFromUnansweredId(null);
  };

  // ── 儲存 ──
  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      showMsg('問題與答案為必填', 'err'); return;
    }
    setSaving(true);
    if (mode === 'edit' && selected) {
      const r = await apiFetch(`${API}/${selected}`, {
        method: 'PUT',
        body: JSON.stringify({
          question:   form.question.trim(),
          answer:     form.answer.trim(),
          keywords:   form.keywords.trim() || null,
          is_active:  form.is_active,
          start_date: form.start_date || null,
          end_date:   form.end_date   || null,
        }),
      });
      if (r.ok) { showMsg('已儲存'); await loadNodes(); }
      else showMsg('儲存失敗', 'err');
    } else {
      const r = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({
          question:   form.question.trim(),
          answer:     form.answer.trim(),
          keywords:   form.keywords.trim() || null,
          start_date: form.start_date || null,
          end_date:   form.end_date   || null,
        }),
      });
      if (r.ok) {
        const node = await r.json();
        showMsg('已新增');
        setSelected(node.id);
        setForm({
          question:   node.question,
          answer:     node.answer,
          keywords:   node.keywords ?? '',
          is_active:  node.is_active,
          start_date: node.start_date ? node.start_date.slice(0, 16) : '',
          end_date:   node.end_date   ? node.end_date.slice(0, 16)   : '',
        });
        setMode('edit');
        setLinks([]);
        await loadNodes();
        if (fromUnansweredId) {
          const uid = fromUnansweredId;
          await apiFetch(`${API}/unanswered/${uid}`, { method: 'DELETE' });
          setFromUnansweredId(null);
          setUnanswered(prev => prev.filter(u => u.id !== uid));
        }
      } else showMsg('新增失敗', 'err');
    }
    setSaving(false);
  };

  // ── 刪除節點 ──
  const handleDelete = async () => {
    const node = nodes.find(n => n.id === selected);
    if (!window.confirm(`確定刪除「${node?.question}」？\n此節點的所有連結都會一併移除。`)) return;
    await apiFetch(`${API}/${selected}`, { method: 'DELETE' });
    setSelected(null); setMode(null); setLinks([]);
    showMsg('已刪除');
    await loadNodes();
  };

  // ── 後續問題：新增連結 ──
  const handleAddLink = async (childId) => {
    const r = await apiFetch(`${API}/${selected}/links`, {
      method: 'POST',
      body: JSON.stringify({ child_id: childId }),
    });
    if (r.ok) {
      setShowLinkSelector(false);
      setLinkSearch('');
      await loadLinks(selected);
    } else showMsg('新增連結失敗', 'err');
  };

  // ── 後續問題：移除連結 ──
  const handleRemoveLink = async (linkId) => {
    await apiFetch(`${API}/links/${linkId}`, { method: 'DELETE' });
    await loadLinks(selected);
  };

  // ── 後續問題：上下移 ──
  const handleMoveLink = async (idx, dir) => {
    const arr = [...links];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    const items = arr.map((l, i) => ({ link_id: l.link_id, sort_order: i }));
    await apiFetch(`${API}/${selected}/links/reorder`, { method: 'PUT', body: JSON.stringify(items) });
    setLinks(arr);
  };

  // ── 圖片上傳（共用邏輯）──
  const uploadImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await apiFetch(`${API}/upload`, { method: 'POST', body: fd });
      if (!r.ok) { showMsg('圖片上傳失敗', 'err'); return; }
      const { url } = await r.json();
      insertAtCursor(`![圖片](${url})`);
    } catch {
      showMsg('圖片上傳失敗', 'err');
    }
    setUploading(false);
  };

  const insertAtCursor = (text) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const val   = ta.value;
    const newVal = val.slice(0, start) + text + val.slice(end);
    setForm(f => ({ ...f, answer: newVal }));
    setTimeout(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  // ── 拖曳上傳 ──
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadImage(file);
  };

  // ── 點擊上傳圖片 ──
  const handleImageBtn = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => uploadImage(e.target.files?.[0]);
    input.click();
  };

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
    const { start, end } = savedSel;
    const selText = form.answer.slice(start, end).trim() || '連結文字';
    insertAtCursor(`[${selText}](${url})`);
    setLinkPopup(false);
    setLinkUrl('');
  };

  // ── 篩選邏輯 ──
  const filteredNodes = nodes.filter(n =>
    !nodeSearch || n.question.includes(nodeSearch) || (n.keywords && n.keywords.includes(nodeSearch))
  );
  const linkedChildIds = new Set(links.map(l => l.id));
  const filteredLinkable = nodes.filter(n =>
    n.id !== selected &&
    !linkedChildIds.has(n.id) &&
    (!linkSearch || n.question.includes(linkSearch) || (n.keywords && n.keywords.includes(linkSearch)))
  );

  if (loading) return <p className="fg-loading">載入中…</p>;

  return (
    <div className="fg-manager faq-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">FAQ 管理</h1>
        <button className="fg-btn fg-btn-primary" onClick={handleNew}>＋ 新增問題</button>
      </div>

      {msg && (
        <div className="admin-popup-overlay">
          <div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div>
        </div>
      )}

      {/* ── 無法回答設定 ── */}
      <div className="faq-fallback-section">
        <div className="faq-fallback-header">
          <span className="faq-fallback-title">無法回答時的訊息</span>
          <span className="faq-hint">當搜尋結果不夠準確或找不到相關問題時顯示，支援 [文字](網址) 連結語法</span>
        </div>
        <textarea
          className="faq-textarea faq-fallback-textarea"
          value={fallbackMsg}
          onChange={e => setFallbackMsg(e.target.value)}
          rows={3}
          placeholder="例：抱歉，我暫時無法回答此問題。&#10;您可以透過 [意見回饋](/CustomerFeedback) 或洽詢現場客服人員。"
        />
        <div className="faq-fallback-actions">
          <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleSaveFallback} disabled={savingFallback}>
            {savingFallback ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>

      {/* ── AI 知識庫問答 ── */}
      <div className="faq-fallback-section faq-ai-section">
        <div className="faq-unanswered-header faq-ai-header" onClick={() => setShowAiSection(v => !v)}>
          <span className="faq-unanswered-title faq-ai-title">AI 知識庫問答</span>
          <span className="faq-unanswered-toggle">{showAiSection ? '▲ 收起' : '▼ 展開'}</span>
        </div>
        {showAiSection && (
          <div className="faq-ai-body">
            <div className="faq-hint" style={{ margin: '0 0 10px' }}>
              開啟後，前台 FAQ 對話框的文字/語音自由輸入問答會改由 AWS Bedrock（基於知識庫）回答，
              並同時回覆語音；點選既有的後續問題 chip 不受影響。若 AWS 成本過高，可隨時關閉退回原本的
              關鍵字比對機制。「立即同步知識庫」會把目前有效的 FAQ 問答與樓層導覽的櫃位資料
              （店家名稱、位置、電話、簡介）一併同步進知識庫。詳細設定見 docs/faq-ai-voice-setup.md。
            </div>
            <label className="faq-toggle-row">
              <input
                type="checkbox"
                checked={aiEnabled}
                disabled={!canWrite || savingAi}
                onChange={e => handleToggleAi(e.target.checked)}
              />
              <span>啟用 AI 問答（語音／文字）</span>
            </label>
            <div className="faq-fallback-actions">
              <button
                className="fg-btn fg-btn-primary fg-btn-sm"
                onClick={handleSyncKb}
                disabled={!canWrite || syncing}
              >
                {syncing ? '同步中…' : '立即同步知識庫'}
              </button>
            </div>
            {syncResult && (
              <div className={`faq-hint${syncResult.ok ? '' : ' faq-wordcloud-status--err'}`} style={{ marginTop: 8 }}>
                {syncResult.ok
                  ? `已同步 ${syncResult.uploaded} 筆，刪除 ${syncResult.deleted} 筆舊資料${syncResult.ingestionJob ? `，索引工作狀態：${syncResult.ingestionJob.status}` : '（尚未設定 Knowledge Base，僅完成 S3 同步）'}`
                  : `同步失敗：${syncResult.error}`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 客服文件 ── */}
      <div className="faq-fallback-section faq-ai-section">
        <div className="faq-unanswered-header faq-ai-header" onClick={() => setShowDocsSection(v => !v)}>
          <span className="faq-unanswered-title faq-ai-title">
            客服文件
            {documents.length > 0 && <span className="faq-unanswered-badge">{documents.length}</span>}
          </span>
          <span className="faq-unanswered-toggle">{showDocsSection ? '▲ 收起' : '▼ 展開'}</span>
        </div>
        {showDocsSection && (
          <div className="faq-ai-body">
            <div className="faq-hint" style={{ margin: '0 0 10px' }}>
              上傳純文字（.txt，2MB 以內）客服文件，例如樓層介紹、服務規範。設定的起訖日期會寫進文件內容，
              由 AI 在回答時動態判斷是否仍在有效期間內，不需要每天重新同步。上傳後記得回到上方按
              「立即同步知識庫」才會生效。
            </div>

            <div className="faq-date-row">
              <div className="faq-date-field" style={{ flex: 2 }}>
                <label className="faq-label">文件標題</label>
                <input
                  className="faq-input"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="例：3樓樓層介紹"
                  disabled={!canWrite}
                />
              </div>
              <div className="faq-date-field">
                <label className="faq-label">有效開始</label>
                <input
                  type="date"
                  className="faq-input"
                  value={docStart}
                  onChange={e => setDocStart(e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div className="faq-date-field">
                <label className="faq-label">有效結束</label>
                <input
                  type="date"
                  className="faq-input"
                  value={docEnd}
                  onChange={e => setDocEnd(e.target.value)}
                  disabled={!canWrite}
                />
              </div>
            </div>

            <input
              ref={docFileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={e => setDocFile(e.target.files?.[0] ?? null)}
              disabled={!canWrite}
              style={{ marginTop: 10 }}
            />

            <div className="faq-fallback-actions">
              <button
                className="fg-btn fg-btn-primary fg-btn-sm"
                onClick={handleUploadDoc}
                disabled={!canWrite || uploadingDoc}
              >
                {uploadingDoc ? '上傳中…' : '上傳文件'}
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="faq-tree-empty">尚無客服文件</div>
            ) : (
              <div className="faq-linked-list" style={{ marginTop: 12 }}>
                {documents.map(doc => (
                  <div key={doc.id} className="faq-linked-item">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={doc.is_active}
                        disabled={!canWrite}
                        onChange={e => handleToggleDocActive(doc, e.target.checked)}
                      />
                    </label>
                    <span className="faq-linked-q">
                      {doc.title}
                      <span className="faq-hint" style={{ marginLeft: 8 }}>
                        {doc.start_date || doc.end_date
                          ? `${doc.start_date ? doc.start_date.slice(0, 10) : '無起始'} ～ ${doc.end_date ? doc.end_date.slice(0, 10) : '無結束'}`
                          : '長期有效'}
                      </span>
                    </span>
                    {canWrite && (
                      <button className="faq-icon-btn faq-icon-btn--del" onClick={() => handleDeleteDoc(doc)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 未解答問題 ── */}
      {unanswered.length > 0 && (
        <div className="faq-unanswered-section">
          <div className="faq-unanswered-header" onClick={() => setShowUnanswered(v => !v)}>
            <span className="faq-unanswered-title">
              待補充問題
              <span className="faq-unanswered-badge">{unanswered.length}</span>
            </span>
            <span className="faq-unanswered-toggle">{showUnanswered ? '▲ 收起' : '▼ 展開'}</span>
          </div>
          {showUnanswered && (
            <div className="faq-unanswered-list">
              {unanswered.map(u => (
                <div key={u.id} className="faq-unanswered-row">
                  <span className="faq-unanswered-count">×{u.ask_count}</span>
                  <span className="faq-unanswered-query">{u.query}</span>
                  <div className="faq-unanswered-actions">
                    <button className="fg-btn fg-btn-primary fg-btn-sm"
                      onClick={() => handleCreateFromUnanswered(u.id, u.query)}>
                      建立問題
                    </button>
                    <button className="fg-btn fg-btn-ghost fg-btn-sm"
                      onClick={() => handleDismissUnanswered(u.id)}>
                      忽略
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 查詢文字雲 ── */}
      <div className="faq-wordcloud-section">
        <div className="faq-wordcloud-header" onClick={() => {
          if (!showWordCloud) { setShowWordCloud(true); loadWordCloud(); }
          else setShowWordCloud(false);
        }}>
          <span className="faq-wordcloud-title">查詢文字雲</span>
          <div className="faq-wordcloud-header-right">
            {showWordCloud && (
              <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={e => { e.stopPropagation(); loadWordCloud(); }}>
                重新整理
              </button>
            )}
            <span className="faq-unanswered-toggle">{showWordCloud ? '▲ 收起' : '▼ 展開'}</span>
          </div>
        </div>
        {showWordCloud && (
          <div className="faq-wordcloud-body">
            {wcLoading
              ? <div className="faq-wordcloud-status">載入中…</div>
              : wcError
                ? <div className="faq-wordcloud-status faq-wordcloud-status--err">{wcError}</div>
              : wordCloudWords.length === 0
                ? <div className="faq-wordcloud-status">尚無查詢紀錄，請先讓使用者使用 FAQ 後再查看</div>
                : <canvas ref={canvasRef} className="faq-wordcloud-canvas" width={700} height={340} />
            }
          </div>
        )}
      </div>

      <div className="faq-layout">

        {/* ── 左側：節點列表 ── */}
        <div className="faq-tree-panel">
          <div className="faq-tree-header">所有問題（{nodes.length}）</div>
          <input
            className="faq-node-search"
            placeholder="搜尋問題…"
            value={nodeSearch}
            onChange={e => setNodeSearch(e.target.value)}
          />
          {filteredNodes.length === 0
            ? <div className="faq-tree-empty">尚無問題</div>
            : filteredNodes.map(n => (
              <div
                key={n.id}
                className={`faq-node-row${n.id === selected ? ' faq-node-row--selected' : ''}${!n.is_active ? ' faq-node-row--inactive' : ''}`}
                onClick={() => handleSelect(n)}
              >
                <span className="faq-node-q">{n.question}</span>
                <span className="faq-node-badges">
                  {n.is_root  && <span className="faq-badge faq-badge--root">根</span>}
                  {!n.is_active && <span className="faq-badge faq-badge--off">停用</span>}
                </span>
              </div>
            ))
          }
        </div>

        {/* ── 右側：編輯區 ── */}
        <div className="faq-form-panel">
          {!mode
            ? <div className="faq-form-empty">← 選擇左側問題編輯，或點「新增問題」</div>
            : (
              <>
                <div className="faq-form-title">
                  {mode === 'edit' ? '編輯問題' : '新增問題'}
                </div>

                <label className="faq-label">問題 <span className="faq-required">*</span></label>
                <input
                  className="faq-input"
                  value={form.question}
                  onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                  placeholder="輸入問題"
                />

                <div className="faq-answer-header">
                  <label className="faq-label" style={{ margin: 0 }}>答案 <span className="faq-required">*</span></label>
                  <div className="faq-toolbar">
                    <button type="button" className="faq-toolbar-btn" onClick={handleLinkBtn}>🔗 加入連結</button>
                    <button type="button" className="faq-toolbar-btn" onClick={handleImageBtn} disabled={uploading}>
                      {uploading ? '上傳中…' : '🖼 插入圖片'}
                    </button>
                    <button type="button" className={`faq-toolbar-btn${showPreview ? ' faq-toolbar-btn--active' : ''}`}
                      onClick={() => setShowPreview(v => !v)}>
                      {showPreview ? '隱藏預覽' : '顯示預覽'}
                    </button>
                  </div>
                </div>

                {linkPopup && (
                  <div className="faq-link-popup">
                    <input
                      ref={linkUrlRef}
                      className="faq-link-input"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      placeholder="輸入網址，例：/service 或 https://..."
                      onKeyDown={e => {
                        if (e.key === 'Enter')  handleInsertLink();
                        if (e.key === 'Escape') setLinkPopup(false);
                      }}
                    />
                    <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleInsertLink}>插入</button>
                    <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setLinkPopup(false)}>取消</button>
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  className={`faq-textarea${dragOver ? ' faq-textarea--dragover' : ''}`}
                  value={form.answer}
                  onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                  placeholder={uploading ? '圖片上傳中…' : '輸入答案內容，或將圖片拖曳至此'}
                  rows={5}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />

                {showPreview && form.answer && (
                  <div className="faq-preview">
                    <div className="faq-preview-label">預覽</div>
                    <div className="faq-preview-body"><AnswerText text={form.answer} /></div>
                  </div>
                )}

                <label className="faq-label">
                  關鍵字 <span className="faq-hint">（空格分隔，用於搜尋比對）</span>
                </label>
                <input
                  className="faq-input"
                  value={form.keywords}
                  onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                  placeholder="例：停車 收費 折抵"
                />

                <div className="faq-date-row">
                  <div className="faq-date-field">
                    <label className="faq-label" style={{ marginTop: 16 }}>
                      有效開始時間 <span className="faq-hint">（空白 = 無限制）</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="faq-input"
                      value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    />
                  </div>
                  <div className="faq-date-field">
                    <label className="faq-label" style={{ marginTop: 16 }}>
                      有效結束時間 <span className="faq-hint">（空白 = 無限制）</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="faq-input"
                      value={form.end_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                {mode === 'edit' && (
                  <label className="faq-toggle-row">
                    <input type="checkbox" checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <span>啟用此問題</span>
                  </label>
                )}

                <div className="faq-form-actions">
                  <button className="fg-btn fg-btn-ghost" onClick={() => { setMode(null); setSelected(null); }}>取消</button>
                  <button className="fg-btn fg-btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? '儲存中…' : '儲存'}
                  </button>
                  {mode === 'edit' && (
                    <button className="fg-btn fg-btn-danger" onClick={handleDelete}>刪除節點</button>
                  )}
                </div>

                {/* ── 後續問題（連結管理）── */}
                {mode === 'edit' && (
                  <div className="faq-links-section">
                    <div className="faq-links-header">
                      <span className="faq-links-title">後續問題</span>
                      <button className="fg-btn fg-btn-sm fg-btn-primary"
                        onClick={() => { setShowLinkSelector(v => !v); setLinkSearch(''); }}>
                        {showLinkSelector ? '取消' : '＋ 新增連結'}
                      </button>
                    </div>

                    {showLinkSelector && (
                      <div className="faq-link-selector">
                        <input
                          className="faq-node-search"
                          placeholder="搜尋要連結的問題…"
                          value={linkSearch}
                          onChange={e => setLinkSearch(e.target.value)}
                          autoFocus
                        />
                        <div className="faq-link-options">
                          {filteredLinkable.length === 0
                            ? <div className="faq-tree-empty">無可連結的問題</div>
                            : filteredLinkable.map(n => (
                              <div key={n.id} className="faq-link-option" onClick={() => handleAddLink(n.id)}>
                                {n.question}
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}

                    {links.length === 0
                      ? <div className="faq-tree-empty">尚未設定後續問題</div>
                      : (
                        <div className="faq-linked-list">
                          {links.map((l, i) => (
                            <div key={l.link_id} className="faq-linked-item">
                              <div className="faq-linked-order">
                                <button className="faq-icon-btn" onClick={() => handleMoveLink(i, 'up')}  disabled={i === 0}>↑</button>
                                <button className="faq-icon-btn" onClick={() => handleMoveLink(i, 'down')} disabled={i === links.length - 1}>↓</button>
                              </div>
                              <span className="faq-linked-q">{l.question}</span>
                              <button className="faq-icon-btn faq-icon-btn--del" onClick={() => handleRemoveLink(l.link_id)}>✕</button>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </div>
                )}
              </>
            )
          }
        </div>
      </div>
    </div>
  );
}
