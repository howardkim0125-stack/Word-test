/* ============================================================
 * review.js — 숙련도와 자동 목록
 *  - 숙련도: new(출제 0회) / learning / known(최근 3번 모두 정답 또는 직접 '외움' 표시)
 *  - 자동 목록: 오늘 복습, 최근 틀린 단어, 정답률 60% 미만, 아직 안 푼 단어, 이번 주 추가, 외운 단어
 *    (항상 지금 데이터로 계산 — 따로 저장하지 않음)
 *  - 복습 간격: 맞히면 1→3→7→14→30일, 틀리면 1일 / 연속 학습일, 하루 목표
 * ============================================================ */

const MASTERY_LABEL = { new: '새 단어', learning: '학습 중', known: '외움' };
const DAY = 24 * 60 * 60 * 1000;

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

/* ---------- 복습 간격 ---------- */

const REVIEW_STEPS = [1, 3, 7, 14, 30]; // 일

/** 그날 0시 */
function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 시험 결과로 다음 복습일 정하기: 맞히면 간격을 한 단계 늘리고, 틀리면 1일 */
function scheduleReview(w, correct, now = Date.now()) {
  if (correct) {
    w.interval = REVIEW_STEPS.find(s => s > (w.interval || 0)) || REVIEW_STEPS[REVIEW_STEPS.length - 1];
  } else {
    w.interval = 1;
  }
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() + w.interval);
  w.nextReview = d.getTime();
}

/** 오늘(또는 그 전에) 복습할 차례인 단어인지 */
function isDue(w) {
  return !!w.nextReview && w.nextReview < startOfDay() + DAY;
}

/** 복습이 필요한 단어인지 (오늘 복습할 차례) */
function needsReview(w) {
  return isDue(w);
}

/* ---------- 날짜별 학습량 (연속 학습일, 하루 목표, 통계) ---------- */

/** 푼 문제 수와 정답 수를 오늘 날짜에 더함 (400일 지난 기록은 정리) */
function recordDaily(n, ok, ts = Date.now()) {
  if (!n) return;
  const k = dayKey(ts);
  const d = state.daily[k] || { n: 0, ok: 0 };
  d.n += n;
  d.ok += ok;
  state.daily[k] = d;
  const oldest = dayKey(ts - 400 * DAY);
  Object.keys(state.daily).forEach(key => { if (key < oldest) delete state.daily[key]; });
  saveDaily();
}

function todaySolved() {
  return (state.daily[dayKey()] || {}).n || 0;
}

/** 연속 학습일: 오늘(오늘 아직 안 했으면 어제)부터 거꾸로 하루도 빠짐없이 공부한 날 수 */
function streakDays() {
  const d = new Date();
  if (!state.daily[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  let count = 0;
  while ((state.daily[dayKey(d.getTime())] || {}).n > 0) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/* ---------- 자동 목록 ---------- */

/** 이번 주 월요일 0시 */
function startOfWeek(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (d.getDay() + 6) % 7; // 월요일 = 0
  return d.getTime() - diff * DAY;
}

const AUTO_LISTS = [
  { id: 'auto:due', name: '오늘 복습', desc: '복습 간격(1·3·7·14·30일)에 따라 오늘 다시 볼 단어', color: 5, icon: '↻',
    filter: w => isDue(w),
    sort: (a, b) => a.nextReview - b.nextReview },
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
