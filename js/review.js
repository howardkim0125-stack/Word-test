/* ============================================================
 * review.js — 숙련도와 자동 목록
 *  - 숙련도: new(출제 0회) / learning / known(최근 3번 모두 정답 또는 직접 '외움' 표시)
 *  - 자동 목록: 최근 틀린 단어, 정답률 60% 미만, 아직 안 푼 단어, 이번 주 추가, 외운 단어
 *    (항상 지금 데이터로 계산 — 따로 저장하지 않음)
 * ============================================================ */

const MASTERY_LABEL = { new: '새 단어', learning: '학습 중', known: '외움' };

/** 단어의 숙련도 */
function masteryOf(w) {
  if (w.markedKnown) return 'known';
  if (!w.asked) return 'new';
  const r = w.recent || [];
  if (r.length >= 3 && r.slice(-3).every(x => x === 1)) return 'known';
  return 'learning';
}

/** 숙련도별 개수 */
function masteryCounts(words) {
  const c = { new: 0, learning: 0, known: 0 };
  words.forEach(w => { c[masteryOf(w)]++; });
  return c;
}

/** 숙련도 진행 막대 HTML (외움 · 학습 중 · 새 단어) */
function masteryBarHtml(words, withLegend = false) {
  const c = masteryCounts(words);
  const total = words.length || 1;
  const seg = k => `<span class="mb-${k}" style="width:${(c[k] / total) * 100}%"></span>`;
  const legend = withLegend
    ? `<span class="mastery-legend"><i class="dot mb-known"></i>외움 ${c.known} · <i class="dot mb-learning"></i>학습 중 ${c.learning} · <i class="dot mb-new"></i>새 단어 ${c.new}</span>`
    : '';
  return `<span class="mastery-bar" role="img" aria-label="외움 ${c.known}, 학습 중 ${c.learning}, 새 단어 ${c.new}">${seg('known')}${seg('learning')}${seg('new')}</span>${legend}`;
}

/** 시험 결과를 단어에 기록 (최근 결과, 오답 시각). 틀리면 직접 표시한 '외움'도 풀림 */
function recordWordResult(w, correct, now = Date.now()) {
  w.recent = [...(w.recent || []), correct ? 1 : 0].slice(-10);
  if (!correct) {
    w.lastWrongAt = now;
    w.markedKnown = false;
  }
}

/** '외움' 직접 표시 / 해제 */
function setMarkedKnown(ids, value) {
  const set = new Set(ids);
  state.words.forEach(w => { if (set.has(w.id)) w.markedKnown = value; });
  saveWords();
}

/** 복습이 필요한 단어인지 (학습 중인 단어) */
function needsReview(w) {
  return masteryOf(w) === 'learning';
}

/* ---------- 자동 목록 ---------- */

const DAY = 24 * 60 * 60 * 1000;

/** 이번 주 월요일 0시 */
function startOfWeek(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (d.getDay() + 6) % 7; // 월요일 = 0
  return d.getTime() - diff * DAY;
}

const AUTO_LISTS = [
  { id: 'auto:wrong', name: '최근 틀린 단어', desc: '최근 2주 안에 시험에서 틀린 단어', color: 7, icon: '✗',
    filter: w => w.lastWrongAt && Date.now() - w.lastWrongAt < 14 * DAY,
    sort: (a, b) => b.lastWrongAt - a.lastWrongAt },
  { id: 'auto:low', name: '정답률 60% 미만', desc: '한 번 이상 출제됐고 정답률이 60%보다 낮은 단어', color: 2, icon: '↓',
    filter: w => w.asked > 0 && (w.asked - w.wrong) / w.asked < 0.6 },
  { id: 'auto:new', name: '아직 안 푼 단어', desc: '한 번도 출제되지 않은 단어', color: 4, icon: '★',
    filter: w => !w.asked },
  { id: 'auto:week', name: '이번 주 추가', desc: '이번 주(월요일부터)에 등록한 단어', color: 1, icon: '＋',
    filter: w => w.createdAt >= startOfWeek() },
  { id: 'auto:known', name: '외운 단어', desc: '최근 3번 연속 맞혔거나 직접 외움으로 표시한 단어', color: 6, icon: '✓',
    filter: w => masteryOf(w) === 'known' }
];

function isAutoList(id) {
  return typeof id === 'string' && id.startsWith('auto:');
}

function getAutoList(id) {
  return AUTO_LISTS.find(a => a.id === id) || null;
}

/** 자동 목록의 단어 (지금 데이터로 계산) */
function autoListWords(id) {
  const a = getAutoList(id);
  if (!a) return [];
  const words = state.words.filter(a.filter);
  return a.sort ? words.sort(a.sort) : words;
}
