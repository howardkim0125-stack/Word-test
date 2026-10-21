/* ============================================================
 * recommend.js — 추천 단어 (스포티파이 "추천 곡"처럼)
 *  - 라이브러리 상세 아래 최대 10개
 *  - 출처: 같은 단어팩에서 아직 없는 단어 / 최근 틀린 단어 / 사전에서 어근·접두사가 비슷한 단어
 *  - ＋ 바로 추가, ✕ 숨기기(다시 추천 안 함), "새로 고침"
 * ============================================================ */

const REC_LIMIT = 10;
let recCache = { libId: null, items: [] }; // 지금 보이는 추천 (새로 고침 전까지 유지)

// 어근을 찾을 때 떼어 보는 끝말 (긴 것부터)
const ROOT_SUFFIXES = ['ization', 'ation', 'ition', 'tion', 'sion', 'ment', 'ness', 'ity', 'ance', 'ence', 'able', 'ible',
  'ful', 'less', 'ive', 'ous', 'ism', 'ist', 'ize', 'ise', 'ally', 'ly', 'al', 'er', 'or', 'ing', 'ed', 'es', 's', 'e', 'y'];

/** 어근(대략): 끝말을 하나 떼고, 4글자보다 짧아지면 앞 5글자 */
function roughRoot(word) {
  const w = wordKey(word);
  if (w.includes(' ')) return null; // 숙어는 제외
  for (const suf of ROOT_SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length);
  }
  return w.length >= 5 ? w.slice(0, 5) : null;
}

let rootIndex = null;
/** 사전 단어를 어근별로 묶은 색인 (처음 한 번만) */
function getRootIndex() {
  if (rootIndex) return rootIndex;
  rootIndex = new Map();
  getDictIndex().map.forEach(e => {
    const r = roughRoot(e.word);
    if (!r) return;
    if (!rootIndex.has(r)) rootIndex.set(r, []);
    rootIndex.get(r).push(e);
  });
  return rootIndex;
}

/** 숨긴 추천 목록 (라이브러리마다, '모든 단어'는 설정에) */
function hiddenRecsOf(libId) {
  const lib = getLibrary(libId);
  return lib ? lib.hiddenRecs : state.settings.hiddenRecs;
}

/**
 * 추천 단어 계산
 * @returns {Array<{ word, meanings, reason, wordId }>}  wordId: 이미 내 단어장에 있는 단어면 그 ID
 */
function computeRecommendations(libId) {
  if (isAutoList(libId)) return [];
  const lib = getLibrary(libId);
  const libWords = libraryWords(libId);
  const inLib = new Set(libWords.map(w => wordKey(w.word)));
  const hidden = new Set(hiddenRecsOf(libId));
  const seen = new Set();
  const pick = (cands, max) => {
    const out = [];
    for (const c of shuffle(cands)) {
      if (out.length >= max) break;
      const k = wordKey(c.word);
      if (inLib.has(k) || hidden.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  };
  const withMine = (e, reason) => {
    const mine = findWord(e.word);
    return { word: mine ? mine.word : e.word, meanings: mine ? mine.meanings : e.meanings, reason, wordId: mine ? mine.id : null };
  };

  // 1) 같은 단어팩: 단어팩에서 온 라이브러리, 또는 이 라이브러리 단어가 많이 든 단어팩
  let packs = [];
  if (lib && lib.packId) packs = WORD_PACKS.filter(p => p.id === lib.packId);
  else if (libWords.length) {
    packs = WORD_PACKS
      .map(p => ({ p, n: packWordList(p).filter(it => inLib.has(wordKey(it.word))).length }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 2)
      .map(x => x.p);
  }
  const fromPack = packs.flatMap(p => packWordList(p).map(it => withMine(it, `같은 단어팩 · ${p.name}`)));

  // 2) 최근 틀린 단어 (이 라이브러리에 없는 것)
  const fromWrong = libId === 'all' ? [] : autoListWords('auto:wrong').map(w => ({ word: w.word, meanings: w.meanings, reason: '최근 틀린 단어', wordId: w.id }));

  // 3) 어근·접두사가 비슷한 사전 단어
  const roots = getRootIndex();
  const fromRoot = [];
  shuffle(libWords).slice(0, 40).forEach(w => {
    const r = roughRoot(w.word);
    (roots.get(r) || []).forEach(e => { if (wordKey(e.word) !== wordKey(w.word)) fromRoot.push(withMine(e, `${w.word}와(과) 어근이 비슷`)); });
  });

  // 섞어서 최대 10개 (출처마다 몫을 나누고, 모자라면 다른 출처로 채움)
  const items = [...pick(fromRoot, 4), ...pick(fromWrong, 3), ...pick(fromPack, 4)];
  const rest = [...fromRoot, ...fromPack, ...fromWrong];
  items.push(...pick(rest, REC_LIMIT - items.length));
  return shuffle(items).slice(0, REC_LIMIT);
}

/** 추천 목록 그리기 (refresh=true면 새로 계산) */
function renderRecommendations(refresh = false) {
  const box = $('#rec-section');
  if (isAutoList(currentLibId)) { box.hidden = true; return; }
  if (refresh || recCache.libId !== currentLibId) {
    recCache = { libId: currentLibId, items: computeRecommendations(currentLibId) };
  }
  // 그 사이 추가했거나 숨긴 단어는 빼기
  const inLib = new Set(libraryWords(currentLibId).map(w => wordKey(w.word)));
  const hidden = new Set(hiddenRecsOf(currentLibId));
  recCache.items = recCache.items.filter(r => !inLib.has(wordKey(r.word)) && !hidden.has(wordKey(r.word)));
  box.hidden = false;
  $('#rec-list').innerHTML = recCache.items.map((r, i) => `
    <li class="rec-item">
      <button class="btn-icon" data-rec-speak="${i}" aria-label="${escapeHtml(r.word)} 발음 듣기">🔊</button>
      <div class="rec-main">
        <b>${escapeHtml(r.word)}</b> <span>${escapeHtml(r.meanings.slice(0, 2).join(', '))}</span>
        <small>${escapeHtml(r.reason)}${r.wordId ? ' · 내 단어' : ''}</small>
      </div>
      <button class="icon-btn add-btn" data-rec-add="${i}" aria-label="${escapeHtml(r.word)} 추가">＋</button>
      <button class="icon-btn" data-rec-hide="${i}" aria-label="${escapeHtml(r.word)} 추천 숨기기">✕</button>
    </li>`).join('');
  $('#rec-empty').hidden = recCache.items.length > 0;
}

/** ＋: 바로 추가 (내 단어장에 없으면 만들고, 이 라이브러리에 담음) */
function addRecommendation(i) {
  const r = recCache.items[i];
  if (!r) return;
  let w = r.wordId ? getWordById(r.wordId) : findWord(r.word);
  if (!w) {
    w = createWordRecord({ word: r.word, meanings: r.meanings.slice() });
    state.words.push(w);
    saveWords();
  }
  const lib = getLibrary(currentLibId);
  if (lib) { addWordsToLibrary(lib.id, [w.id]); touchLibrary(lib.id); }
  recCache.items.splice(i, 1);
  refreshListView();
  showToast(`"${w.word}" 추가${lib ? ` → ${lib.name}` : ''}`);
}

/** ✕: 이 라이브러리에서 다시 추천하지 않음 */
function hideRecommendation(i) {
  const r = recCache.items[i];
  if (!r) return;
  const list = hiddenRecsOf(currentLibId);
  list.push(wordKey(r.word));
  if (getLibrary(currentLibId)) saveLibraries(); else saveSettings();
  recCache.items.splice(i, 1);
  renderRecommendations();
}

function initRecommendations() {
  $('#rec-refresh-btn').addEventListener('click', () => renderRecommendations(true));
  $('#rec-list').addEventListener('click', e => {
    const add = e.target.closest('[data-rec-add]');
    const hide = e.target.closest('[data-rec-hide]');
    const sp = e.target.closest('[data-rec-speak]');
    if (add) addRecommendation(Number(add.dataset.recAdd));
    else if (hide) hideRecommendation(Number(hide.dataset.recHide));
    else if (sp) speak(recCache.items[Number(sp.dataset.recSpeak)]?.word || '');
  });
}
