/* ============================================================
 * stats.js — 통계 탭, 테스트 탭의 "오늘" 카드
 *  - 최근 14일 푼 문제 수와 정답률 그래프, 많이 틀린 단어 TOP 10, 숙련도 비율
 *  - 그래프는 외부 라이브러리 없이 SVG로 그림 (색은 CSS 변수라 다크 모드도 따라감)
 * ============================================================ */

/** 최근 n일 (오래된 날 → 오늘) [{ key, label, n, ok }] */
function recentDays(n = 14) {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = dayKey(d.getTime());
    const v = state.daily[key] || { n: 0, ok: 0 };
    out.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, n: v.n, ok: v.ok });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** 14일 그래프: 막대 = 푼 문제 수(왼쪽 축), 점과 선 = 정답률(오른쪽 축) */
function dailyChartSvg(days) {
  const W = 640, H = 240, L = 40, R = 44, T = 20, B = 40;
  const cw = W - L - R, ch = H - T - B;
  const maxN = Math.max(10, state.settings.dailyGoal, ...days.map(d => d.n));
  const step = cw / days.length;
  const bw = Math.min(28, step * 0.6);
  const y = v => T + ch - (v / maxN) * ch;
  const yPct = p => T + ch - p * ch;
  const bars = days.map((d, i) => {
    const x = L + i * step + (step - bw) / 2;
    const h = (d.n / maxN) * ch;
    return `<rect class="chart-bar" x="${x.toFixed(1)}" y="${(T + ch - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3"><title>${d.label} · ${d.n}문제${d.n ? ` · 정답률 ${Math.round((d.ok / d.n) * 100)}%` : ''}</title></rect>`;
  }).join('');
  const pts = days.map((d, i) => d.n ? [L + i * step + step / 2, yPct(d.ok / d.n), Math.round((d.ok / d.n) * 100)] : null).filter(Boolean);
  const line = pts.length > 1 ? `<polyline class="chart-line" points="${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}"/>` : '';
  const dots = pts.map(p => `<circle class="chart-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4"><title>정답률 ${p[2]}%</title></circle>`).join('');
  const labels = days.map((d, i) => (i % 2 === (days.length - 1) % 2)
    ? `<text class="chart-label" x="${(L + i * step + step / 2).toFixed(1)}" y="${H - B + 18}" text-anchor="middle">${d.label}</text>` : '').join('');
  const goalY = y(state.settings.dailyGoal);
  return `<svg class="stats-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 14일 푼 문제 수와 정답률">
    <line class="chart-axis" x1="${L}" y1="${T + ch}" x2="${W - R}" y2="${T + ch}"/>
    <line class="chart-goal" x1="${L}" y1="${goalY.toFixed(1)}" x2="${W - R}" y2="${goalY.toFixed(1)}"/>
    <text class="chart-label goal" x="${L + 4}" y="${(goalY - 5).toFixed(1)}">목표 ${state.settings.dailyGoal}</text>
    <text class="chart-label" x="${L - 6}" y="${T + 4}" text-anchor="end">${maxN}</text>
    <text class="chart-label" x="${L - 6}" y="${T + ch + 4}" text-anchor="end">0</text>
    <text class="chart-label pct" x="${W - R + 6}" y="${T + 4}">100%</text>
    <text class="chart-label pct" x="${W - R + 6}" y="${T + ch + 4}">0%</text>
    ${bars}${line}${dots}${labels}
  </svg>`;
}

/** 숙련도 비율 도넛 (외움 · 학습 중 · 새 단어) */
function masteryDonutSvg(c) {
  const total = c.known + c.learning + c.new;
  const r = 60, C = 2 * Math.PI * r;
  let offset = 0;
  const arcs = ['known', 'learning', 'new'].map(k => {
    const len = total ? (c[k] / total) * C : 0;
    const arc = `<circle class="donut-${k}" cx="80" cy="80" r="${r}" fill="none" stroke-width="22"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 80 80)"/>`;
    offset += len;
    return arc;
  }).join('');
  const pct = total ? Math.round((c.known / total) * 100) : 0;
  return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="외움 ${c.known}, 학습 중 ${c.learning}, 새 단어 ${c.new}">
    <circle class="donut-bg" cx="80" cy="80" r="${r}" fill="none" stroke-width="22"/>
    ${arcs}
    <text class="donut-num" x="80" y="80" text-anchor="middle">${pct}%</text>
    <text class="donut-sub" x="80" y="100" text-anchor="middle">외움</text>
  </svg>`;
}

/** 많이 틀린 단어 TOP n */
function topWrongWords(n = 10) {
  return state.words
    .filter(w => w.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || (accuracyOf(a) ?? 0) - (accuracyOf(b) ?? 0))
    .slice(0, n);
}

function renderStats() {
  const days = recentDays(14);
  const sum = days.reduce((a, d) => ({ n: a.n + d.n, ok: a.ok + d.ok }), { n: 0, ok: 0 });
  const today = todaySolved();
  const goal = state.settings.dailyGoal;
  $('#stats-summary').innerHTML = [
    ['단어', `${state.words.length}개`],
    ['오늘 푼 문제', `${today} / ${goal}`],
    ['연속 학습', `${streakDays()}일`],
    ['오늘 복습', `${state.words.filter(w => isDue(w)).length}개`],
    ['14일 정답률', sum.n ? `${Math.round((sum.ok / sum.n) * 100)}%` : '-']
  ].map(([k, v]) => `<div class="stat-tile"><span>${k}</span><b>${v}</b></div>`).join('');

  $('#stats-chart').innerHTML = sum.n ? dailyChartSvg(days) : '<p class="empty">최근 14일 동안 푼 문제가 없어요. 테스트를 풀면 여기에 그래프가 생겨요.</p>';
  $('#stats-chart-sub').textContent = sum.n ? `14일 동안 ${sum.n}문제 · 정답 ${sum.ok}개` : '';

  const top = topWrongWords(10);
  $('#stats-top').innerHTML = top.length ? top.map((w, i) => `
    <li class="top-item">
      <span class="top-rank">${i + 1}</span>
      <button class="btn-icon" data-speak="${escapeHtml(w.word)}" aria-label="${escapeHtml(w.word)} 발음 듣기">🔊</button>
      <div class="top-main"><b>${escapeHtml(w.word)}</b> <span>${escapeHtml(w.meanings.join(', '))}</span></div>
      <span class="top-meta">오답 ${w.wrong}회 · ${accuracyOf(w)}%</span>
    </li>`).join('') : '<li class="empty">아직 틀린 단어가 없어요.</li>';
  $('#stats-top-test').hidden = top.length === 0;

  const c = masteryCounts(state.words);
  $('#stats-mastery').innerHTML = state.words.length ? `
    ${masteryDonutSvg(c)}
    <ul class="donut-legend">
      <li><i class="dot mb-known"></i>외움 <b>${c.known}</b></li>
      <li><i class="dot mb-learning"></i>학습 중 <b>${c.learning}</b></li>
      <li><i class="dot mb-new"></i>새 단어 <b>${c.new}</b></li>
    </ul>` : '<p class="empty">단어가 없어요.</p>';
}

/* ---------- 테스트 탭의 "오늘" 카드 (복습 간격, 연속 학습일, 하루 목표) ---------- */

function renderTodayCard() {
  const due = state.words.filter(w => isDue(w)).length;
  const today = todaySolved();
  const goal = state.settings.dailyGoal;
  $('#today-due').textContent = `${due}개`;
  $('#today-streak').textContent = `${streakDays()}일`;
  $('#today-goal').textContent = `${today} / ${goal}`;
  $('#today-goal-bar').style.width = `${Math.min(100, (today / goal) * 100)}%`;
  $('#today-goal-item').classList.toggle('done', today >= goal);
  $('#today-review-btn').disabled = due === 0;
  $('#today-review-btn').textContent = due ? `▶ 오늘 복습 ${due}개` : '오늘 복습 끝 ✓';
}

function initStats() {
  $('#stats-top').addEventListener('click', e => {
    const b = e.target.closest('[data-speak]');
    if (b) speak(b.dataset.speak);
  });
  $('#stats-top-test').addEventListener('click', async () => {
    const words = topWrongWords(10);
    if (!words.length || !(await confirmDiscardRun())) return;
    switchTab('test');
    startTest(words, { scope: ['all'], scopeName: '많이 틀린 단어 TOP 10' });
  });
  $('#today-review-btn').addEventListener('click', () => startScopeTest(['auto:due']));
}
