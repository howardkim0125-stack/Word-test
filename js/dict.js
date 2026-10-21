/* ============================================================
 * dict.js — 영한 사전 찾기 (등록 화면 자동완성)
 *  - 사전 항목: { word, level(1 초등1 ~ 9 고등3), senses: [{ pos, meanings }],
 *                 pos(첫 품사), meanings(칩으로 채울 기본 뜻) }
 *  - 접두사 자동완성, 변화형(abandoned, studies, ran) → 원형 찾기
 *  - 한글로 찾기 (포기하다 → abandon, give up)
 *  - left·saw처럼 다른 단어의 변화형이기도 한 단어는 "leave의 과거·과거분사" 안내
 *  - 내 단어장에 있는 단어는 사용자가 고친 뜻을 사전 뜻보다 우선
 *  - 사전에 없을 때: 영영 뜻(Free Dictionary), 참고용 번역(MyMemory), 네이버 사전 링크
 * ============================================================ */

const POS_LABEL = { n: '명', v: '동', a: '형', ad: '부', p: '전', c: '접', pr: '대', i: '감', aux: '조', det: '한', ph: '숙어' };
const POS_NAME = { n: '명사', v: '동사', a: '형용사', ad: '부사', p: '전치사', c: '접속사', pr: '대명사', i: '감탄사', aux: '조동사', det: '한정사', ph: '숙어' };

// 불규칙 동사 "원형 과거 과거분사" (형태가 여러 개면 /로)
const IRREGULAR_VERBS = `be was/were been;have had had;do did done;go went gone;come came come;become became become;
see saw seen;take took taken;give gave given;make made made;get got got/gotten;know knew known;think thought thought;
bring brought brought;buy bought bought;catch caught caught;teach taught taught;fight fought fought;seek sought sought;
say said said;pay paid paid;lay laid laid;lie lay lain;tell told told;sell sold sold;find found found;hold held held;
stand stood stood;understand understood understood;leave left left;feel felt felt;keep kept kept;sleep slept slept;
mean meant meant;meet met met;send sent sent;spend spent spent;build built built;lend lent lent;lose lost lost;
lead led led;feed fed fed;flee fled fled;run ran run;begin began begun;sing sang sung;swim swam swum;drink drank drunk;
ring rang rung;sink sank sunk;shrink shrank shrunk;write wrote written;ride rode ridden;rise rose risen;drive drove driven;
eat ate eaten;fall fell fallen;forget forgot forgotten;forgive forgave forgiven;hide hid hidden;bite bit bitten;
break broke broken;speak spoke spoken;steal stole stolen;choose chose chosen;freeze froze frozen;wake woke woken;
wear wore worn;tear tore torn;bear bore born/borne;swear swore sworn;throw threw thrown;grow grew grown;draw drew drawn;
fly flew flown;blow blew blown;show showed shown;shake shook shaken;strike struck struck;stick stuck stuck;dig dug dug;
hang hung hung;win won won;sit sat sat;hear heard heard;shoot shot shot;light lit lit;slide slid slid;arise arose arisen;
overcome overcame overcome;withdraw withdrew withdrawn;undergo underwent undergone;overtake overtook overtaken;
mistake mistook mistaken;undertake undertook undertaken;forbid forbade forbidden;foresee foresaw foreseen;
beat beat beaten;bend bent bent;bind bound bound;bleed bled bled;breed bred bred;deal dealt dealt;dream dreamt dreamt;
grind ground ground;wind wound wound;sweep swept swept;weep wept wept;creep crept crept;kneel knelt knelt;
leap leapt leapt;spill spilt spilt;spin spun spun;spit spat spat;sting stung stung;swing swung swung;cling clung clung;
stink stank stunk;tread trod trodden;weave wove woven;mislead misled misled;uphold upheld upheld;withstand withstood withstood;
shine shone shone;sow sowed sown;sew sewed sewn;swell swelled swollen;prove proved proven;stride strode stridden;
strive strove striven;speed sped sped;slay slew slain;seek sought sought;feed fed fed;overhear overheard overheard`;

// 불규칙 복수형 "복수:단수", 비교급·최상급 "형태:원형:종류"
const IRREGULAR_PLURALS = `children:child men:man women:woman feet:foot teeth:tooth mice:mouse geese:goose people:person
lives:life knives:knife wives:wife leaves:leaf halves:half wolves:wolf shelves:shelf thieves:thief oxen:ox
phenomena:phenomenon criteria:criterion data:datum media:medium bacteria:bacterium analyses:analysis crises:crisis
hypotheses:hypothesis theses:thesis fungi:fungus stimuli:stimulus nuclei:nucleus cacti:cactus curricula:curriculum
alumni:alumnus larvae:larva indices:index appendices:appendix`;
const IRREGULAR_COMPARE = `better:good:비교급 best:good:최상급 worse:bad:비교급 worst:bad:최상급 more:many:비교급
most:many:최상급 less:little:비교급 least:little:최상급 further:far:비교급 farther:far:비교급 furthest:far:최상급
farthest:far:최상급 elder:old:비교급 eldest:old:최상급`;

let irregularMap = null;
/** 불규칙 변화형 → [{ base, kind }] (처음 한 번만 만듦) */
function getIrregularMap() {
  if (irregularMap) return irregularMap;
  irregularMap = new Map();
  const add = (form, base, kind) => {
    if (form === base) return;
    const list = irregularMap.get(form) || [];
    const same = list.find(x => x.base === base);
    if (same) { if (!same.kind.includes(kind)) same.kind += `·${kind}`; } else list.push({ base, kind });
    irregularMap.set(form, list);
  };
  IRREGULAR_VERBS.split(';').forEach(line => {
    const [base, past, pp] = line.trim().split(/\s+/);
    if (!pp) return;
    past.split('/').forEach(f => add(f, base, '과거'));
    pp.split('/').forEach(f => add(f, base, '과거분사'));
  });
  IRREGULAR_PLURALS.split(/\s+/).filter(Boolean).forEach(p => { const [f, b] = p.split(':'); add(f, b, '복수형'); });
  IRREGULAR_COMPARE.split(/\s+/).filter(Boolean).forEach(p => { const [f, b, k] = p.split(':'); add(f, b, k); });
  return irregularMap;
}

/* ---------- 사전 항목 ---------- */

/** "n:뜻,뜻;v:뜻" → [{ pos, meanings }] */
function parseSenses(text) {
  return String(text || '').split(';').map(g => {
    const i = g.indexOf(':');
    return { pos: i > 0 ? g.slice(0, i) : '', meanings: g.slice(i + 1).split(',').filter(Boolean) };
  }).filter(s => s.meanings.length);
}

/** 칩으로 채울 기본 뜻: 품사가 하나면 앞의 3개, 여러 개면 품사마다 2개씩 (최대 5개) */
function defaultMeanings(senses) {
  const per = senses.length === 1 ? 3 : 2;
  const out = [];
  senses.forEach(s => s.meanings.slice(0, per).forEach(m => { if (!out.includes(m)) out.push(m); }));
  return out.slice(0, 5);
}

/** 사전 항목의 모든 뜻 (품사 순서대로) */
function allMeanings(entry) {
  return entry.senses ? [...new Set(entry.senses.flatMap(s => s.meanings))] : entry.meanings.slice();
}

function makeDictEntry(word, level, senses) {
  return { word, level, senses, pos: senses[0] ? senses[0].pos : '', meanings: defaultMeanings(senses) };
}

let dictIndex = null;

/** 사전 색인 만들기 (처음 한 번만): 소문자 키 → 사전 항목, 정렬된 키 목록 */
function getDictIndex() {
  if (dictIndex) return dictIndex;
  const map = new Map();
  Object.keys(DICT_DATA).forEach(w => {
    const [level, text] = DICT_DATA[w];
    map.set(w.toLowerCase(), makeDictEntry(w, level, parseSenses(text)));
  });
  // 안전장치: 단어팩에 있는데 사전 데이터에 빠진 단어도 찾을 수 있게
  WORD_PACKS.forEach(p => packWordList(p).forEach(it => {
    const k = it.word.toLowerCase();
    if (!map.has(k)) map.set(k, makeDictEntry(it.word, 0, [{ pos: '', meanings: it.meanings.slice(0, 3) }]));
  }));
  dictIndex = { map, keys: Array.from(map.keys()).sort() };
  return dictIndex;
}

/** 사전에서 정확히 찾기 */
function dictGet(word) {
  return getDictIndex().map.get(wordKey(word)) || null;
}

/** 단어의 난이도 (사전에 없으면 0) */
function dictLevel(word) {
  const e = dictGet(word);
  return e ? e.level : 0;
}

/** 변화형 → 원형 후보 (studies → study, abandoned → abandon, running → run, bigger → big, ran → run 등) */
function lemmaCandidates(word) {
  const w = wordKey(word);
  const out = [];
  const add = s => { if (s && s.length >= 2 && s !== w && !out.includes(s)) out.push(s); };
  const undouble = s => (/([bcdfgklmnprstvz])\1$/.test(s) ? s.slice(0, -1) : null);
  (getIrregularMap().get(w) || []).forEach(x => add(x.base));
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

/** 불규칙 변화형 안내: left → ["leave의 과거·과거분사"] (사전에 있는 원형만) */
function inflectionNotes(word) {
  return (getIrregularMap().get(wordKey(word)) || [])
    .filter(x => dictGet(x.base))
    .map(x => `${x.base}의 ${x.kind}`);
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
 *  한글을 입력하면 뜻으로 찾기 (dictReverse)
 * @returns {Array<{word, pos, senses, level, meanings, mine, from, notes}>}
 */
function dictSuggest(input, limit = 5) {
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(input)) return dictReverse(input, limit);
  const key = wordKey(input);
  if (!key) return [];
  const out = [];
  const seen = new Set();
  const push = (entry, extra = {}) => {
    if (!entry || out.length >= limit) return;
    const k = entry.word.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ ...withUserMeanings(entry), notes: inflectionNotes(entry.word), ...extra });
  };

  const mineExact = findWord(key);
  const exact = dictGet(key);
  if (mineExact) push({ ...(exact || { pos: '', level: 0 }), word: mineExact.word, meanings: mineExact.meanings });
  push(exact);
  // 변화형이면 원형도 (left → leave, saw → see)
  lemmaCandidates(key).forEach(c => { const e = dictGet(c); if (e) push(e, { from: key }); });

  // 내 단어장에서 접두사가 맞는 단어
  state.words
    .filter(w => w.word.toLowerCase().startsWith(key))
    .sort((a, b) => a.word.length - b.word.length)
    .slice(0, limit)
    .forEach(w => push({ ...(dictGet(w.word) || { pos: '', level: 0 }), word: w.word, meanings: w.meanings }));

  // 사전에서 접두사가 맞는 단어: 쉬운 단어·짧은 단어부터 (mira → mirage보다 miracle)
  const { keys, map } = getDictIndex();
  const matches = [];
  for (let i = lowerBound(keys, key); i < keys.length && matches.length < 200; i++) {
    if (!keys[i].startsWith(key)) break;
    matches.push(keys[i]);
  }
  const rank = k => (map.get(k).level || 10) + k.length / 2;
  matches.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1)).forEach(k => push(map.get(k)));
  return out;
}

/* ---------- 한글로 찾기 (포기하다 → abandon) ---------- */

let reverseIndex = null;
/** 뜻(다듬은 한글) → 사전 항목 목록, 정렬된 뜻 목록 (처음 한글을 입력할 때 한 번만) */
function getReverseIndex() {
  if (reverseIndex) return reverseIndex;
  const map = new Map();
  getDictIndex().map.forEach(e => {
    allMeanings(e).forEach(m => {
      const k = koClean(m);
      if (!k) return;
      if (!map.has(k)) map.set(k, []);
      const list = map.get(k);
      if (!list.includes(e)) list.push(e);
    });
  });
  reverseIndex = { map, keys: Array.from(map.keys()).sort() };
  return reverseIndex;
}

/**
 * 뜻으로 영단어 찾기: 뜻이 똑같은 단어 → 그 말로 시작하는 뜻의 단어
 *  쉬운 단어(난이도 낮은 것)·짧은 단어부터
 * @returns 자동완성 후보와 같은 형태 (+ matched: 찾은 뜻)
 */
function dictReverse(input, limit = 5) {
  const key = koClean(input);
  if (!key) return [];
  const { map, keys } = getReverseIndex();
  const rank = e => (e.level || 10) * 100 + e.word.length;
  const out = [];
  const seen = new Set();
  const push = (e, matched) => {
    if (out.length >= limit || seen.has(e.word)) return;
    seen.add(e.word);
    // 찾은 뜻을 칩 맨 앞에
    const meanings = [matched, ...e.meanings.filter(m => m !== matched)].slice(0, 5);
    out.push({ ...e, meanings, matched, notes: [] });
  };
  const exactKeys = [key, ...koForms(input)].filter((k, i, a) => a.indexOf(k) === i);
  const exact = [];
  exactKeys.forEach(k => (map.get(k) || []).forEach(e => exact.push(e)));
  exact.sort((a, b) => rank(a) - rank(b)).forEach(e => push(e, allMeanings(e).find(m => exactKeys.includes(koClean(m))) || e.meanings[0]));
  const prefix = [];
  for (let i = lowerBound(keys, key); i < keys.length && prefix.length < 80; i++) {
    if (!keys[i].startsWith(key)) break;
    map.get(keys[i]).forEach(e => prefix.push([e, keys[i]]));
  }
  prefix.sort((a, b) => a[1].length - b[1].length || rank(a[0]) - rank(b[0]))
    .forEach(([e, k]) => push(e, allMeanings(e).find(m => koClean(m) === k) || e.meanings[0]));
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
