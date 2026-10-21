/* ============================================================
 * dict.js — 영한 사전 찾기 (등록 화면 자동완성)
 *  - 접두사 자동완성, 변화형(abandoned, studies, running) → 원형 찾기
 *  - 내 단어장에 있는 단어는 사용자가 고친 뜻을 사전 뜻보다 우선
 *  - 사전에 없을 때: 영영 뜻(Free Dictionary), 참고용 번역(MyMemory), 네이버 사전 링크
 * ============================================================ */

const POS_LABEL = { n: '명', v: '동', a: '형', ad: '부', p: '전', c: '접', pr: '대', i: '감', aux: '조', det: '한', ph: '숙어' };

// 규칙으로 찾기 어려운 불규칙 변화형 → 원형
const IRREGULAR_FORMS = {
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do',
  went: 'go', gone: 'go', goes: 'go', came: 'come', became: 'become', saw: 'see', seen: 'see',
  took: 'take', taken: 'take', gave: 'give', given: 'give', made: 'make', got: 'get', gotten: 'get',
  knew: 'know', known: 'know', thought: 'think', brought: 'bring', bought: 'buy', caught: 'catch',
  taught: 'teach', fought: 'fight', sought: 'seek', said: 'say', paid: 'pay', laid: 'lay', lain: 'lie',
  lay: 'lie', told: 'tell', sold: 'sell', found: 'find', held: 'hold', stood: 'stand', understood: 'understand',
  left: 'leave', felt: 'feel', kept: 'keep', slept: 'sleep', meant: 'mean', met: 'meet', sent: 'send',
  spent: 'spend', built: 'build', lent: 'lend', lost: 'lose', led: 'lead', fed: 'feed', fled: 'flee',
  ran: 'run', began: 'begin', begun: 'begin', sang: 'sing', sung: 'sing', swam: 'swim', drank: 'drink',
  drunk: 'drink', rang: 'ring', sank: 'sink', shrank: 'shrink', wrote: 'write', written: 'write',
  rode: 'ride', ridden: 'ride', rose: 'rise', risen: 'rise', drove: 'drive', driven: 'drive',
  ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall', forgot: 'forget', forgotten: 'forget',
  forgave: 'forgive', forgiven: 'forgive', hid: 'hide', hidden: 'hide', bit: 'bite', bitten: 'bite',
  broke: 'break', broken: 'break', spoke: 'speak', spoken: 'speak', stole: 'steal', stolen: 'steal',
  chose: 'choose', chosen: 'choose', froze: 'freeze', frozen: 'freeze', woke: 'wake', woken: 'wake',
  wore: 'wear', worn: 'wear', tore: 'tear', torn: 'tear', bore: 'bear', born: 'bear', borne: 'bear',
  swore: 'swear', sworn: 'swear', threw: 'throw', thrown: 'throw', grew: 'grow', grown: 'grow',
  drew: 'draw', drawn: 'draw', flew: 'fly', flown: 'fly', blew: 'blow', blown: 'blow', showed: 'show',
  shown: 'show', shook: 'shake', shaken: 'shake', struck: 'strike', stuck: 'stick', dug: 'dig',
  hung: 'hang', won: 'win', sat: 'sit', heard: 'hear', fit: 'fit', shot: 'shoot', lit: 'light',
  slid: 'slide', arose: 'arise', arisen: 'arise', overcame: 'overcome', withdrew: 'withdraw',
  withdrawn: 'withdraw', underwent: 'undergo', undergone: 'undergo', overtook: 'overtake', mistook: 'mistake',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose',
  people: 'person', lives: 'life', knives: 'knife', wives: 'wife', leaves: 'leaf', halves: 'half',
  wolves: 'wolf', shelves: 'shelf', thieves: 'thief', phenomena: 'phenomenon', criteria: 'criterion',
  data: 'datum', analyses: 'analysis', crises: 'crisis', hypotheses: 'hypothesis', theses: 'thesis',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', more: 'many', most: 'many', less: 'little',
  least: 'little', further: 'far', farther: 'far', furthest: 'far'
};

let dictIndex = null;

/** 사전 색인 만들기 (처음 한 번만): 소문자 키 → { word, pos, meanings }, 정렬된 키 목록 */
function getDictIndex() {
  if (dictIndex) return dictIndex;
  const map = new Map();
  Object.keys(DICT_DATA).forEach(w => {
    const [pos, meanings] = DICT_DATA[w];
    map.set(w.toLowerCase(), { word: w, pos, meanings });
  });
  // 안전장치: 단어팩에 있는데 사전 데이터에 빠진 단어도 찾을 수 있게
  WORD_PACKS.forEach(p => packWordList(p).forEach(it => {
    const k = it.word.toLowerCase();
    if (!map.has(k)) map.set(k, { word: it.word, pos: '', meanings: it.meanings.slice(0, 3) });
  }));
  dictIndex = { map, keys: Array.from(map.keys()).sort() };
  return dictIndex;
}

/** 사전에서 정확히 찾기 */
function dictGet(word) {
  return getDictIndex().map.get(wordKey(word)) || null;
}

/** 변화형 → 원형 후보 (studies → study, abandoned → abandon, running → run, bigger → big 등) */
function lemmaCandidates(word) {
  const w = wordKey(word);
  const out = [];
  const add = s => { if (s && s.length >= 2 && s !== w && !out.includes(s)) out.push(s); };
  const undouble = s => (/([bcdfgklmnprstvz])\1$/.test(s) ? s.slice(0, -1) : null);
  if (IRREGULAR_FORMS[w]) add(IRREGULAR_FORMS[w]);
  if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ves$/.test(w)) { add(w.slice(0, -3) + 'f'); add(w.slice(0, -3) + 'fe'); }
  if (/(s|x|z|ch|sh|o)es$/.test(w)) add(w.slice(0, -2));
  if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
  if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ed$/.test(w)) { const s = w.slice(0, -2); add(s); add(w.slice(0, -1)); add(undouble(s)); }
  if (/ying$/.test(w)) add(w.slice(0, -4) + 'ie'); // dying → die
  if (/ing$/.test(w)) { const s = w.slice(0, -3); add(s); add(s + 'e'); add(undouble(s)); }
  if (/ier$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/iest$/.test(w)) add(w.slice(0, -4) + 'y');
  if (/er$/.test(w)) { const s = w.slice(0, -2); add(s); add(w.slice(0, -1)); add(undouble(s)); }
  if (/est$/.test(w)) { const s = w.slice(0, -3); add(s); add(w.slice(0, -2)); add(undouble(s)); }
  if (/ily$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ly$/.test(w)) add(w.slice(0, -2));
  return out;
}

/**
 * 단어 찾기: 정확히 → 변화형의 원형 순서
 * @returns {{ entry, from } | null} from: 입력한 변화형 (원형으로 찾은 경우)
 */
function dictLookup(word) {
  const exact = dictGet(word);
  if (exact) return { entry: exact, from: null };
  for (const cand of lemmaCandidates(word)) {
    const e = dictGet(cand);
    if (e) return { entry: e, from: wordKey(word) };
  }
  return null;
}

/** 사전 항목에 내 단어장의 뜻을 덮어씀 (사용자가 고친 뜻이 항상 우선) */
function withUserMeanings(entry) {
  const mine = findWord(entry.word);
  return mine ? { ...entry, word: mine.word, meanings: mine.meanings.slice(), mine: true } : { ...entry };
}

/** 정렬된 키에서 접두사로 시작하는 첫 위치 (이진 탐색) */
function lowerBound(keys, prefix) {
  let lo = 0, hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] < prefix) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/**
 * 자동완성 후보 (최대 limit개)
 *  순서: 정확히 일치 → 원형 → 내 단어장 접두사 → 사전 접두사
 * @returns {Array<{word, pos, meanings, mine, from}>}
 */
function dictSuggest(input, limit = 5) {
  const key = wordKey(input);
  if (!key) return [];
  const out = [];
  const seen = new Set();
  const push = (entry, extra = {}) => {
    if (!entry || out.length >= limit) return;
    const k = entry.word.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ ...withUserMeanings(entry), ...extra });
  };

  const mineExact = findWord(key);
  if (mineExact) push({ word: mineExact.word, pos: dictGet(key)?.pos || '', meanings: mineExact.meanings });
  push(dictGet(key));
  const lemma = dictLookup(key);
  if (lemma && lemma.from) push(lemma.entry, { from: lemma.from });

  // 내 단어장에서 접두사가 맞는 단어
  state.words
    .filter(w => w.word.toLowerCase().startsWith(key))
    .sort((a, b) => a.word.length - b.word.length)
    .slice(0, limit)
    .forEach(w => push({ word: w.word, pos: dictGet(w.word)?.pos || '', meanings: w.meanings }));

  // 사전에서 접두사가 맞는 단어 (짧은 단어가 기본 단어인 경우가 많아 짧은 것부터)
  const { keys, map } = getDictIndex();
  const matches = [];
  for (let i = lowerBound(keys, key); i < keys.length && matches.length < 40; i++) {
    if (!keys[i].startsWith(key)) break;
    matches.push(keys[i]);
  }
  matches.sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).forEach(k => push(map.get(k)));
  return out;
}

/* ---------- 사전에 없을 때: 온라인 참고 (인터넷이 없으면 조용히 실패) ---------- */

/** 시간 제한이 있는 JSON 요청 */
async function fetchJsonWithTimeout(url, ms = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 영영 뜻 (Free Dictionary API) → [{ pos, def }] 최대 4개 */
async function fetchEnglishDefinitions(word) {
  const data = await fetchJsonWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordKey(word))}`);
  const defs = [];
  (Array.isArray(data) ? data : []).forEach(entry => (entry.meanings || []).forEach(m =>
    (m.definitions || []).slice(0, 2).forEach(d => defs.push({ pos: m.partOfSpeech || '', def: d.definition }))));
  return defs.slice(0, 4);
}

/** 참고용 한국어 번역 (MyMemory) → 문자열 또는 null */
async function fetchReferenceTranslation(word) {
  const data = await fetchJsonWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(wordKey(word))}&langpair=en|ko`);
  const text = String(data?.responseData?.translatedText || '').trim();
  // 번역이 안 되고 영어 그대로 돌아오면 쓰지 않음
  if (!text || !/[가-힣]/.test(text)) return null;
  return text;
}

function naverDictUrl(word) {
  return `https://en.dict.naver.com/#/search?query=${encodeURIComponent(wordKey(word))}`;
}
