/* ============================================================
 * storage.js — localStorage 저장/불러오기
 *  - 단어 목록, 설정, 백업 정보를 각각 별도 키로 저장
 * ============================================================ */

const STORAGE_KEYS = {
  words: 'wt.words',
  settings: 'wt.settings',
  meta: 'wt.meta' // 마지막 백업 시각, 최초 사용 시각 등
};

const DEFAULT_SETTINGS = {
  count: 20,          // 출제 개수
  direction: 'en2ko', // en2ko | ko2en | mix
  format: 'input',    // input(주관식) | choice(객관식)
  mode: 'random'      // random | weighted
};

// 앱 전체에서 공유하는 상태
const state = {
  words: [],
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
  state.settings = { ...DEFAULT_SETTINGS, ...readJSON(STORAGE_KEYS.settings, {}) };
  state.meta = { lastBackup: null, firstUse: null, ...readJSON(STORAGE_KEYS.meta, {}) };
  if (!state.meta.firstUse) {
    state.meta.firstUse = Date.now();
    saveMeta();
  }
}

function saveWords() { return writeJSON(STORAGE_KEYS.words, state.words); }
function saveSettings() { return writeJSON(STORAGE_KEYS.settings, state.settings); }
function saveMeta() { return writeJSON(STORAGE_KEYS.meta, state.meta); }

/**
 * 단어 레코드 형식을 맞춰 줌 (가져오기/구버전 데이터 대비)
 * 형식: { id, word, meanings[], memo, asked, wrong, createdAt, updatedAt, lastTested, sample }
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
    sample: !!r.sample
  };
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
