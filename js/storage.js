/* ============================================================
 * storage.js — localStorage 저장/불러오기
 *  - 단어 목록, 라이브러리, 설정, 백업 정보 등을 각각 별도 키로 저장
 *  - 새 필드는 normalize 함수에서 기본값을 채워 예전 데이터·백업도 그대로 읽힘
 * ============================================================ */

const STORAGE_KEYS = {
  words: 'wt.words',
  libraries: 'wt.libraries',
  settings: 'wt.settings',
  meta: 'wt.meta', // 마지막 백업 시각, 최초 사용 시각 등
  quizRun: 'wt.quizRun', // 진행 중인 시험 (이어서 풀기)
  history: 'wt.history', // 시험 기록 (최대 300개)
  daily: 'wt.daily', // 날짜별 푼 문제 수·정답 수 { 'YYYY-MM-DD': { n, ok } } (연속 학습일·통계용)
  recentAdds: 'wt.recentAdds' // 방금 등록한 단어 (되돌리기용)
};

const DEFAULT_SETTINGS = {
  count: 20,          // 출제 개수 (0 = 전체)
  direction: 'en2ko', // en2ko | ko2en | mix
  format: 'input',    // input(주관식) | choice(객관식) | auto(추천 조합: 영→한 객관식, 한→영 주관식)
  mode: 'random',     // random | weighted
  testLibrary: 'all', // (예전 설정) 출제 범위 하나 — testScope의 첫 번째와 같음
  testScope: ['all'], // 출제 범위: 'all'(모든 단어), 라이브러리 ID, 자동 목록 ID 여러 개 (합쳐서 출제)
  scopeSettings: {},  // 라이브러리마다 마지막 시험 설정 { 라이브러리 ID: { direction, format, mode, count } }
  dailyGoal: 20,      // 하루 목표 (푼 문제 수)
  hiddenRecs: [],     // '모든 단어'의 추천 단어에서 숨긴 단어 (라이브러리는 라이브러리마다 저장)
  addLibrary: '__default__', // 단어 등록 시 넣을 라이브러리 ID ('' = 없음, '__default__' = 기본 라이브러리)
  defaultLibrary: ''  // ＋ 버튼으로 담는 기본 라이브러리 ID ('' = "외울 단어"를 필요할 때 자동 생성)
};

// 앱 전체에서 공유하는 상태
const state = {
  words: [],
  libraries: [],
  history: [],
  daily: {},
  settings: { ...DEFAULT_SETTINGS },
  meta: { lastBackup: null, firstUse: null }
};

/** localStorage에서 JSON 값을 안전하게 읽기 */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('읽기 실패:', key, e);
    return fallback;
  }
}

/** localStorage에 JSON 값을 저장 (용량 초과 등 실패 시 false) */
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('저장 실패:', key, e);
    if (typeof showToast === 'function') showToast('저장에 실패했습니다. 저장 공간을 확인하세요.');
    return false;
  }
}

/** 저장된 모든 데이터를 state로 불러오기 */
function loadAll() {
  const words = readJSON(STORAGE_KEYS.words, []);
  state.words = Array.isArray(words) ? words.map(normalizeWordRecord).filter(Boolean) : [];
  const libs = readJSON(STORAGE_KEYS.libraries, []);
  state.libraries = Array.isArray(libs) ? libs.map(normalizeLibrary).filter(Boolean) : [];
  pruneLibraryWordIds();
  state.settings = normalizeSettings(readJSON(STORAGE_KEYS.settings, {}));
  const hist = readJSON(STORAGE_KEYS.history, []);
  state.history = Array.isArray(hist) ? hist.map(normalizeHistoryEntry).filter(Boolean) : [];
  state.daily = normalizeDaily(readJSON(STORAGE_KEYS.daily, null));
  state.meta = { lastBackup: null, firstUse: null, ...readJSON(STORAGE_KEYS.meta, {}) };
  if (!state.meta.firstUse) {
    state.meta.firstUse = Date.now();
    saveMeta();
  }
}

function saveWords() { return writeJSON(STORAGE_KEYS.words, state.words); }
function saveLibraries() { return writeJSON(STORAGE_KEYS.libraries, state.libraries); }
function saveSettings() { return writeJSON(STORAGE_KEYS.settings, state.settings); }
function saveHistory() { return writeJSON(STORAGE_KEYS.history, state.history); }
function saveDaily() { return writeJSON(STORAGE_KEYS.daily, state.daily); }
function saveMeta() { return writeJSON(STORAGE_KEYS.meta, state.meta); }

/**
 * 설정 형식 맞추기 (예전 설정에 없는 값은 기본값으로)
 *  - 예전 버전에서 '라이브러리 없이'('')로 저장된 등록 대상은 기본 라이브러리로 바꿈
 *    (그때는 기본값이 ''뿐이라 사용자가 고른 값이 아님)
 */
function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? { ...raw } : {};
  if (!('defaultLibrary' in s) && !s.addLibrary) s.addLibrary = '__default__';
  const out = { ...DEFAULT_SETTINGS, ...s };
  const count = parseInt(out.count, 10);
  out.count = Number.isFinite(count) && count >= 0 ? count : DEFAULT_SETTINGS.count;
  if (!['en2ko', 'ko2en', 'mix'].includes(out.direction)) out.direction = DEFAULT_SETTINGS.direction;
  if (!['input', 'choice', 'auto'].includes(out.format)) out.format = DEFAULT_SETTINGS.format;
  if (!['random', 'weighted'].includes(out.mode)) out.mode = DEFAULT_SETTINGS.mode;
  // 예전 설정은 출제 범위가 하나(testLibrary)뿐이었음
  if (!Array.isArray(out.testScope) || !out.testScope.length) out.testScope = [out.testLibrary || 'all'];
  out.testScope = [...new Set(out.testScope.map(String))];
  // 기본값의 객체·배열을 같이 쓰지 않게 복사
  out.scopeSettings = out.scopeSettings && typeof out.scopeSettings === 'object' ? { ...out.scopeSettings } : {};
  const goal = parseInt(out.dailyGoal, 10);
  out.dailyGoal = goal > 0 ? goal : DEFAULT_SETTINGS.dailyGoal;
  out.hiddenRecs = Array.isArray(out.hiddenRecs) ? out.hiddenRecs.map(String) : [];
  return out;
}

/**
 * 단어 레코드 형식을 맞춰 줌 (가져오기/구버전 데이터 대비)
 * 형식: { id, word, meanings[], memo, asked, wrong, createdAt, updatedAt, lastTested, sample,
 *         recent[](최근 결과 1=정답 0=오답, 최대 10개), markedKnown(직접 '외움' 표시), lastWrongAt,
 *         interval(복습 간격 일수, 0=아직 없음), nextReview(다음 복습 날짜) }
 */
function normalizeWordRecord(r) {
  if (!r || typeof r.word !== 'string' || !r.word.trim()) return null;
  let meanings = r.meanings;
  if (typeof meanings === 'string') meanings = splitMeanings(meanings);
  if (!Array.isArray(meanings)) meanings = [];
  meanings = meanings.map(m => String(m).trim()).filter(Boolean);
  if (meanings.length === 0) return null;
  const asked = Math.max(0, parseInt(r.asked, 10) || 0);
  return {
    id: r.id || makeId(),
    word: r.word.trim(),
    meanings,
    memo: typeof r.memo === 'string' ? r.memo : '',
    asked,
    wrong: Math.min(asked, Math.max(0, parseInt(r.wrong, 10) || 0)),
    createdAt: r.createdAt || Date.now(),
    updatedAt: r.updatedAt || r.createdAt || Date.now(),
    lastTested: r.lastTested || null,
    sample: !!r.sample,
    recent: Array.isArray(r.recent) ? r.recent.map(x => (x ? 1 : 0)).slice(-10) : [],
    markedKnown: !!r.markedKnown,
    lastWrongAt: Number(r.lastWrongAt) || null,
    interval: Math.max(0, parseInt(r.interval, 10) || 0),
    nextReview: Number(r.nextReview) || null
  };
}

/**
 * 라이브러리 레코드 형식 맞추기
 * 형식: { id, name, desc, color(표지 색 번호), wordIds[], createdAt, packId(추천 단어팩에서 왔으면 그 ID),
 *         lastUsedAt(마지막으로 단어를 담은 시각 — 담기 시트 정렬용), hiddenRecs[](추천에서 숨긴 단어) }
 *  - 단어 하나가 여러 라이브러리에 들어갈 수 있음 (스포티파이 플레이리스트처럼)
 */
function normalizeLibrary(l) {
  if (!l || typeof l.name !== 'string' || !l.name.trim()) return null;
  return {
    id: l.id || makeId(),
    name: l.name.trim(),
    desc: typeof l.desc === 'string' ? l.desc : '',
    color: Number.isInteger(l.color) ? l.color : 0,
    wordIds: Array.isArray(l.wordIds) ? [...new Set(l.wordIds.map(String))] : [],
    createdAt: l.createdAt || Date.now(),
    packId: l.packId || null,
    lastUsedAt: Number(l.lastUsedAt) || 0,
    hiddenRecs: Array.isArray(l.hiddenRecs) ? l.hiddenRecs.map(String) : []
  };
}

/**
 * 시험 기록 형식 맞추기
 * 형식: { id, at, scope[], scopeName, direction, format, mode, retry, total, correct,
 *         items: [{ wordId, word, ok, dir }] }
 */
function normalizeHistoryEntry(h) {
  if (!h || !Array.isArray(h.items)) return null;
  const items = h.items
    .filter(it => it && it.word)
    .map(it => ({ wordId: String(it.wordId || ''), word: String(it.word), ok: !!it.ok, dir: it.dir === 'ko2en' ? 'ko2en' : 'en2ko' }));
  return {
    id: h.id || makeId(),
    at: Number(h.at) || Date.now(),
    scope: Array.isArray(h.scope) && h.scope.length ? h.scope.map(String) : ['all'],
    scopeName: typeof h.scopeName === 'string' ? h.scopeName : '',
    direction: h.direction || 'en2ko',
    format: h.format || 'input',
    mode: h.mode || 'random',
    retry: !!h.retry,
    total: items.length,
    correct: items.filter(it => it.ok).length,
    items
  };
}

/**
 * 날짜별 학습량 형식 맞추기
 *  - 처음(저장된 값이 없음)이면 시험 기록에서 만들어 줌
 */
function normalizeDaily(raw) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.keys(raw).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const n = Math.max(0, parseInt(raw[k] && raw[k].n, 10) || 0);
      const ok = Math.min(n, Math.max(0, parseInt(raw[k] && raw[k].ok, 10) || 0));
      if (n) out[k] = { n, ok };
    });
    return out;
  }
  state.history.forEach(h => {
    const k = dayKey(h.at);
    out[k] = out[k] || { n: 0, ok: 0 };
    out[k].n += h.total;
    out[k].ok += h.correct;
  });
  return out;
}

/** 타임스탬프 → 'YYYY-MM-DD' (기기 시간대 기준) */
function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 라이브러리에 남아 있는, 이미 삭제된 단어 ID 정리 */
function pruneLibraryWordIds() {
  const ids = new Set(state.words.map(w => w.id));
  state.libraries.forEach(l => { l.wordIds = l.wordIds.filter(id => ids.has(id)); });
}

/** 고유 ID 생성 */
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** "사과, 사과나무" → ['사과', '사과나무'] (중복 제거) */
function splitMeanings(text) {
  const seen = new Set();
  return String(text)
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(s => s && !seen.has(s) && seen.add(s));
}

/** 브라우저에 저장소를 함부로 지우지 말라고 요청 (지원 시) */
function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}
