import React, { useState, useEffect } from 'react';
import './Winners.css';

const NOTICE_ITEMS = [
  '依稅法規定幸運抽獎中獎價值超過新台幣1,000元，將於領獎當年度列入中獎個人綜合所得扣繳，次年度並由本公司寄發「各類所得扣繳暨免扣繳憑單」。',
  '所有幸運抽獎中獎獎值超過新台幣20,000元以上，依稅法規定須代扣10%機會中獎稅。',
  '得獎名單於檔期結束後3日內公布於中友網站或洽顧客服務中心04-2225-3456#888。',
  '本活動將於檔期結束後一周內，以電話方式與得獎者連繫後續領獎事宜，得獎者需將填寫活動相關領據，且須通知日後2週內領取，逾期未領獲獎者視為放棄獲得獎項資格，獎項不另行重抽。',
];

function countLeaves(node, depth, maxDepth) {
  if (depth >= maxDepth - 1 || !node.children?.length) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c, depth + 1, maxDepth), 0);
}

function buildRows(nodes, depth, numCols) {
  const result = [];
  for (const node of nodes) {
    if (depth >= numCols - 1 || !node.children?.length) {
      const row = new Array(numCols).fill(null);
      row[depth] = { value: node.value, rowspan: 1 };
      for (let d = depth + 1; d < numCols; d++) row[d] = { value: '', rowspan: 1 };
      result.push(row);
    } else {
      const span = countLeaves(node, depth, numCols);
      const childRows = buildRows(node.children, depth + 1, numCols);
      childRows[0][depth] = { value: node.value, rowspan: span };
      result.push(...childRows);
    }
  }
  return result;
}

export default function Winners() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/winners')
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-status">載入中…</div>;

  return (
    <div className="winners-page">
      <div className="winners-content">
        <h1 className="winners-title">得獎名單</h1>

        {events.length === 0 && (
          <div className="winners-empty">目前尚無得獎名單</div>
        )}

        {events.map(event => {
          const cols = event.columns ?? [];
          let numCols = cols.length;
          while (numCols > 1 && !cols[numCols - 1]) numCols--;
          const rows = buildRows(event.rows ?? [], 0, numCols);
          const hasData = (event.rows?.length ?? 0) > 0;

          return (
            <div key={event.id} className="winners-event">
              <h2 className="winners-event-title">{event.title}</h2>
              {event.subtitle1 && <p className="winners-event-subtitle">{event.subtitle1}</p>}
              {event.subtitle2 && <p className="winners-event-subtitle">{event.subtitle2}</p>}

              {!hasData ? (
                <p className="winners-event-empty">尚無得獎資料</p>
              ) : (
                <table className="winners-table">
                  <thead>
                    <tr>
                      {(event.columns ?? []).slice(0, numCols).map((col, i) => (
                        <th key={i}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) =>
                          cell === null ? null : (
                            <td key={ci} rowSpan={cell.rowspan}>{cell.value}</td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      <div className="winners-notice">
        <p className="winners-notice-title">注意事項：</p>
        <ol className="winners-notice-list">
          {NOTICE_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
