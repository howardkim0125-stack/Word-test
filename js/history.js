/* ============================================================
 * history.js — 시험 기록 (wt.history, 최대 300개)
 *  - 시험이 끝날 때마다 날짜, 범위, 방향/형식, 점수, 문제별 결과를 저장
 *  - 라이브러리 상세의 "마지막 시험", "시험 기록"(점수 추이 그래프, 그때 틀린 것만 다시 풀기)
 * ============================================================ */

const HISTORY_MAX = 300;

/** 끝난 시험을 기록에 추가 */
function addHistoryFromQuiz(q) {
  if (!q || !q.answers.length) return null;
  const entry = normalizeHistoryEntry({
    at: Date.now(),
    scope: q.scope,
    scopeName: q.scopeName,
    direction: q.settings.direction,
    format: q.settings.format,
    mode: q.settings.mode,
    retry: q.retry,
    items: q.answers.map(a => ({ wordId: a.question.wordId, word: a.question.word, ok: a.correct, dir: a.question.dir }))
  });
  state.history.push(entry);
  if (state.history.length > HISTORY_MAX) state.history = state.history.slice(-HISTORY_MAX);
  saveHistory();
  return entry;
}

/** 이 라이브러리(또는 '모든 단어', 자동 목록)로 본 시험 기록 (최신이 앞) */
function historyForScope(libId) {
  return state.history.filter(h => h.scope.includes(libId)).sort((a, b) => b.at - a.at);
}

function lastHistory(libId) {
  return historyForScope(libId)[0] || null;
}

function scoreText(h) {
  return `${h.correct}/${h.total}`;
}

/** 점수 추이 막대 그래프 (SVG, 오래된 것 → 최근, 최대 20개) */
function historyChartSvg(entries) {
  const list = entries.slice(0, 20).reverse();
  if (!list.length) return '';
  const W = 520, H = 160, pad = 24, gap = 6;
  const bw = Math.max(8, (W - pad * 2 - gap * (list.length - 1)) / list.length);
  const bars = list.map((h, i) => {
    const pct = h.total ? h.correct / h.total : 0;
    const bh = Math.max(2, (H - pad * 2) * pct);
    const x = pad + i * (bw + gap);
    const y = H - pad - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" class="${pct >= 0.8 ? 'bar-good' : pct >= 0.6 ? 'bar-mid' : 'bar-low'}"><title>${formatShortDate(h.at)} · ${scoreText(h)} (${Math.round(pct * 100)}점)</title></rect>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" class="bar-label">${Math.round(pct * 100)}</text>`;
  }).join('');
  return `<svg class="history-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="점수 추이">
    <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" class="axis"/>
    <line x1="${pad}" y1="${pad}" x2="${W - pad}" y2="${pad}" class="grid"/>
    <text x="${pad - 4}" y="${pad + 4}" text-anchor="end" class="bar-label">100</text>
    ${bars}
  </svg>`;
}

/** 라이브러리 상세의 "시험 기록" 대화상자 */
async function openHistoryDialog(libId) {
  const entries = historyForScope(libId);
  const dirText = { en2ko: '영→한', ko2en: '한→영', mix: '섞기' };
  const fmtText = { input: '주관식', choice: '객관식', auto: '추천 조합' };
  const rows = entries.slice(0, 50).map(h => {
    const wrong = h.items.filter(it => !it.ok);
    const pct = h.total ? Math.round((h.correct / h.total) * 100) : 0;
    return `
      <li class="history-row">
        <div class="history-main">
          <b>${formatShortDate(h.at)}</b> <span class="history-score">${scoreText(h)} · ${pct}점</span>
          <small>${escapeHtml(h.scopeName)} · ${dirText[h.direction] || ''} · ${fmtText[h.format] || ''}${h.retry ? ' · 다시 풀기' : ''}</small>
        </div>
        ${wrong.length ? `<button type="button" class="btn btn-small" data-retry="${h.id}">틀린 ${wrong.length}개 다시</button>` : '<span class="hint">만점</span>'}
      </li>`;
  }).join('');
  await showDialog({
    title: `시험 기록 · ${libraryName(libId)}`,
    html: entries.length
      ? `${historyChartSvg(entries)}<ul class="history-list">${rows}</ul>`
      : '<p class="hint">아직 이 범위로 본 시험이 없어요.</p>',
    buttons: [{ label: '닫기', value: null, primary: true }],
    onOpen: body => {
      body.onclick = e => {
        const b = e.target.closest('[data-retry]');
        if (!b) return;
        closeDialog();
        retryFromHistory(b.dataset.retry);
      };
    }
  });
}

/** 기록에서 "그때 틀린 것만 다시 풀기" */
function retryFromHistory(historyId) {
  const h = state.history.find(x => x.id === historyId);
  if (!h) return;
  const words = [...new Set(h.items.filter(it => !it.ok).map(it => it.wordId))].map(getWordById).filter(Boolean);
  if (!words.length) { showToast('그때 틀린 단어가 지금은 없습니다.'); return; }
  switchTab('test');
  startTest(words, {
    scope: h.scope,
    scopeName: `${h.scopeName} · ${formatShortDate(h.at)} 틀린 것`,
    settings: { direction: h.direction, format: h.format, mode: h.mode }
  });
}

/* ---------- 백업 ---------- */

/** 가져온 기록 합치기 (같은 ID는 건너뜀, 단어 ID는 지금 단어장 기준으로 바꿈) */
function mergeHistory(entries, idMap) {
  const have = new Set(state.history.map(h => h.id));
  entries.forEach(h => {
    if (have.has(h.id)) return;
    state.history.push({ ...h, items: h.items.map(it => ({ ...it, wordId: idMap.get(it.wordId) || it.wordId })) });
  });
  state.history.sort((a, b) => a.at - b.at);
  if (state.history.length > HISTORY_MAX) state.history = state.history.slice(-HISTORY_MAX);
}
