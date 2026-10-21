/* ============================================================
 * words.js — 단어 데이터 조작, 되돌리기, 일괄 등록, 예시 단어
 *  - 단어 하나 등록 화면(자동완성)은 register.js
 * ============================================================ */

/* ---------- 데이터 조작 ---------- */

/** 비교용 키: 앞뒤 공백 제거 + 소문자 + 연속 공백 하나로 */
function wordKey(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** 같은 영단어 찾기 (excludeId: 수정 중인 자기 자신은 제외) */
function findWord(text, excludeId = null) {
  const key = wordKey(text);
  return state.words.find(w => wordKey(w.word) === key && w.id !== excludeId) || null;
}

function getWordById(id) {
  return state.words.find(w => w.id === id) || null;
}

/** 새 단어 레코드 만들기 */
function createWordRecord({ word, meanings, memo = '', sample = false }) {
  const now = Date.now();
  return {
    id: makeId(),
    word: word.trim(),
    meanings,
    memo: memo.trim(),
    asked: 0,
    wrong: 0,
    createdAt: now,
    updatedAt: now,
    lastTested: null,
    sample
  };
}

/** 기존 단어 내용 덮어쓰기 (학습 통계는 유지) */
function overwriteWord(existing, { word, meanings, memo = '' }) {
  existing.word = word.trim();
  existing.meanings = meanings;
  existing.memo = memo.trim();
  existing.updatedAt = Date.now();
  existing.sample = false; // 직접 입력한 내용이므로 예시 단어 표시 해제
}

function deleteWord(id) {
  state.words = state.words.filter(w => w.id !== id);
  saveWords();
  removeWordFromAllLibraries(id);
}

/* ---------- 되돌리기 (삭제·빼기·등록 취소) ---------- */

/** 단어들의 현재 상태(레코드 + 라이브러리 소속)를 복사해 둠 */
function snapshotWords(ids) {
  const set = new Set(ids);
  return {
    words: state.words.filter(w => set.has(w.id)).map(w => JSON.parse(JSON.stringify(w))),
    libs: state.libraries
      .map(l => ({ id: l.id, wordIds: l.wordIds.filter(id => set.has(id)) }))
      .filter(x => x.wordIds.length)
  };
}

/** 스냅샷으로 되돌리기: 단어·통계·라이브러리 소속까지 복구 */
function restoreWords(snap) {
  snap.words.forEach(w => {
    const i = state.words.findIndex(x => x.id === w.id);
    if (i >= 0) { state.words[i] = w; return; }
    if (findWord(w.word)) return; // 그 사이 같은 철자로 다시 등록했으면 건너뜀
    state.words.push(w);
  });
  const ids = new Set(state.words.map(w => w.id));
  snap.libs.forEach(({ id, wordIds }) => {
    const lib = getLibrary(id);
    if (lib) lib.wordIds = [...new Set([...lib.wordIds, ...wordIds.filter(x => ids.has(x))])];
  });
  saveWords();
  saveLibraries();
}

/** 완전히 삭제 + "삭제됨 · 되돌리기" 토스트 (6초) */
function deleteWordsWithUndo(ids, after = () => {}) {
  if (!ids.length) return;
  const snap = snapshotWords(ids);
  const set = new Set(ids);
  state.words = state.words.filter(w => !set.has(w.id));
  state.libraries.forEach(l => { l.wordIds = l.wordIds.filter(id => !set.has(id)); });
  saveWords();
  saveLibraries();
  after();
  const label = ids.length === 1 ? `"${snap.words[0]?.word}" 삭제됨` : `${ids.length}개 삭제됨`;
  showToast(label, 6000, { label: '되돌리기', onClick: () => { restoreWords(snap); after(); showToast('되돌렸습니다.'); } });
}

/** 라이브러리에서 빼기 + 되돌리기 토스트 (단어는 '모든 단어'에 남음) */
function removeFromLibraryWithUndo(libId, ids, after = () => {}) {
  const lib = getLibrary(libId);
  if (!lib || !ids.length) return;
  const set = new Set(ids);
  const removed = lib.wordIds.filter(id => set.has(id));
  lib.wordIds = lib.wordIds.filter(id => !set.has(id));
  saveLibraries();
  after();
  const label = removed.length === 1 ? `"${getWordById(removed[0])?.word}" 뺌 · ${lib.name}` : `${removed.length}개 뺌 · ${lib.name}`;
  showToast(label, 6000, {
    label: '되돌리기',
    onClick: () => { addWordsToLibrary(libId, removed); after(); showToast('되돌렸습니다.'); }
  });
}

/* ---------- 저장할 라이브러리 ---------- */

/** 등록 대상 라이브러리 ('__default__'는 기본 라이브러리, 없으면 만듦). 없음이면 null */
function resolveAddLibrary() {
  const v = state.settings.addLibrary;
  if (v === '__default__') return ensureDefaultLibrary();
  return getLibrary(v);
}

/** 등록 화면의 '저장할 라이브러리' 선택 상자 갱신 */
function renderAddLibrarySelect() {
  const select = $('#add-library');
  const def = getDefaultLibrary();
  let selected = state.settings.addLibrary;
  if (selected === '__default__' && def) selected = def.id;
  fillLibrarySelect(select, { selected, includeNone: true, includeNew: true });
  if (!def) {
    // 기본 라이브러리가 아직 없으면 "자동 생성" 항목을 맨 위에
    const opt = new Option(`${DEFAULT_LIB_NAME} (기본 · 처음 등록할 때 만들어져요)`, '__default__');
    select.insertBefore(opt, select.firstChild);
    if (selected === '__default__') select.value = '__default__';
  } else {
    const o = Array.from(select.options).find(x => x.value === def.id);
    if (o) o.textContent += ' · 기본';
  }
}

/** 선택된 라이브러리에 단어 넣기. 넣은 라이브러리 반환 (없으면 null) */
function addToTargetLibrary(wordIds) {
  const lib = resolveAddLibrary();
  if (!lib || wordIds.length === 0) return null;
  addWordsToLibrary(lib.id, wordIds);
  touchLibrary(lib.id);
  return lib;
}

async function handleAddLibraryChange(e) {
  if (e.target.value === '__new__') {
    const lib = await openLibraryDialog();
    if (lib) state.settings.addLibrary = lib.id;
  } else {
    const def = getDefaultLibrary();
    state.settings.addLibrary = def && e.target.value === def.id ? '__default__' : e.target.value;
  }
  saveSettings();
  renderAddLibrarySelect();
}

/* ---------- 일괄 등록 ---------- */

/**
 * "word - 뜻" 형식 텍스트 해석
 *  - 구분자: " - " (공백 포함 하이픈), 탭, " : "  → 하이픈이 들어간 단어(well-known)도 안전
 *  - 공백 없는 하이픈은 오른쪽에 한글 등이 있을 때만 구분자로 봄 (예: "apple-사과")
 *  - allowWordOnly: 영단어만 있는 줄은 wordOnly로 따로 돌려줌 (사전에서 뜻을 채우기 위해)
 * @returns {{items: Array<{word, meanings}>, errors: string[], wordOnly: Array<{word, line}>}}
 */
function parseBulkText(text, { allowWordOnly = false } = {}) {
  const items = [];
  const errors = [];
  const wordOnly = [];
  const lines = String(text).split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const m = line.match(/^(.+?)\s+[-–—:]\s+(.+)$/) || line.match(/^(.+?)\t+(.+)$/) ||
      line.match(/^([^-]+?)\s*-\s*(.*[^\x00-\x7F].*)$/);
    if (!m) {
      if (allowWordOnly && /^[A-Za-z][A-Za-z' .-]*$/.test(line)) wordOnly.push({ word: line, line });
      else errors.push(`${idx + 1}번째 줄: "${line}"`);
      return;
    }
    const word = m[1].trim();
    const meanings = splitMeanings(m[2]);
    if (!word || meanings.length === 0) { errors.push(`${idx + 1}번째 줄: "${line}"`); return; }
    items.push({ word, meanings });
  });

  // 같은 붙여넣기 안에서 중복된 단어는 마지막 줄 기준으로 하나만 남김
  const map = new Map();
  items.forEach(it => map.set(wordKey(it.word), it));
  return { items: Array.from(map.values()), errors, wordOnly };
}

async function handleBulkAdd() {
  const textarea = $('#bulk-input');
  const parsed = parseBulkText(textarea.value, { allowWordOnly: true });
  const { errors } = parsed;

  // 영단어만 있는 줄: 사전에 있으면 뜻 자동 채움, 없으면 입력칸에 남김
  const notFound = [];
  const map = new Map(parsed.items.map(it => [wordKey(it.word), it]));
  parsed.wordOnly.forEach(({ word, line }) => {
    const hit = dictLookup(word);
    if (!hit) { notFound.push(line); return; }
    const entry = withUserMeanings(hit.entry);
    if (!map.has(wordKey(entry.word))) map.set(wordKey(entry.word), { word: entry.word, meanings: entry.meanings.slice() });
  });
  const items = Array.from(map.values());

  if (items.length === 0) {
    if (notFound.length) {
      textarea.value = notFound.join('\n');
      showToast(`사전에 없는 단어 ${notFound.length}개 — "word - 뜻" 형식으로 뜻을 적어 주세요.`, 4000);
    } else {
      showToast(errors.length ? '형식이 맞는 줄이 없습니다. "word - 뜻" 형식을 확인하세요.' : '입력된 내용이 없습니다.');
    }
    return;
  }

  const fresh = items.filter(it => !findWord(it.word));
  const dupes = items.filter(it => findWord(it.word));

  // 이미 있는 단어가 있으면 덮어쓸지 물어보기
  let overwrite = false;
  if (dupes.length > 0) {
    const preview = dupes.slice(0, 15).map(d => {
      const ex = findWord(d.word);
      return `• ${d.word}: ${ex.meanings.join(', ')} → ${d.meanings.join(', ')}`;
    }).join('\n') + (dupes.length > 15 ? `\n… 외 ${dupes.length - 15}개` : '');
    const choice = await showDialog({
      title: `이미 있는 단어 ${dupes.length}개`,
      message: `${preview}\n\n이미 있는 단어를 어떻게 할까요? (학습 통계는 유지됩니다)`,
      buttons: [
        { label: '취소', value: 'cancel' },
        { label: '건너뛰기', value: 'skip' },
        { label: '덮어쓰기', value: 'overwrite', primary: true }
      ]
    });
    if (choice === null || choice === 'cancel') return;
    overwrite = choice === 'overwrite';
  }

  const target = resolveAddLibrary();
  const newRecs = fresh.map(it => { const rec = createWordRecord(it); state.words.push(rec); return rec; });
  const overwritten = overwrite ? dupes.map(it => {
    const ex = findWord(it.word);
    const before = JSON.parse(JSON.stringify(ex));
    overwriteWord(ex, it);
    return { rec: ex, before };
  }) : [];
  saveWords();
  // 되돌리기용 기록 (라이브러리에 넣기 전에 기록해야 "원래 없었음"을 알 수 있음)
  overwritten.forEach(({ rec, before }) => rememberRecentAdd(rec, 'overwrite', before, target));
  newRecs.forEach(rec => rememberRecentAdd(rec, 'new', null, target));
  // 건너뛴 기존 단어도 선택한 라이브러리에는 넣어 줌 (뜻은 그대로)
  const lib = addToTargetLibrary([...newRecs.map(r => r.id), ...dupes.map(it => findWord(it.word).id)]);
  renderAddLibrarySelect();
  renderRecentAdds();

  let msg = `새 단어 ${fresh.length}개 등록`;
  if (dupes.length) msg += overwrite ? `, ${dupes.length}개 덮어씀` : `, ${dupes.length}개 건너뜀`;
  if (lib) msg += ` → ${lib.name}`;

  // 형식이 틀린 줄과 사전에 없는 단어는 다시 고칠 수 있게 입력칸에 남겨 둠
  const leftover = [...errors.map(e => e.replace(/^\d+번째 줄: "(.*)"$/, '$1')), ...notFound];
  textarea.value = leftover.join('\n');
  if (leftover.length) {
    const parts = [];
    if (errors.length) parts.push(`형식이 맞지 않는 줄 ${errors.length}개:\n${errors.slice(0, 15).join('\n')}`);
    if (notFound.length) parts.push(`사전에 없어 뜻을 채우지 못한 단어 ${notFound.length}개:\n${notFound.slice(0, 15).join(', ')}`);
    await showDialog({
      title: msg,
      message: `${parts.join('\n\n')}\n\n입력칸에 남겨 두었으니 "word - 뜻" 형식으로 고쳐서 다시 등록하세요.`
    });
  } else {
    showToast(msg);
  }
}

/* ---------- 예시 단어 ---------- */

function addSampleWords() {
  let added = 0;
  SAMPLE_WORDS.forEach(([word, meaning, memo]) => {
    if (findWord(word)) return; // 이미 있는 단어(직접 입력한 것 포함)는 건드리지 않음
    state.words.push(createWordRecord({ word, meanings: splitMeanings(meaning), memo, sample: true }));
    added++;
  });
  saveWords();
  showToast(added ? `예시 단어 ${added}개를 넣었습니다.` : '예시 단어가 이미 모두 들어 있습니다.');
}

async function removeSampleWords() {
  const count = state.words.filter(w => w.sample).length;
  if (count === 0) { showToast('지울 예시 단어가 없습니다.'); return; }
  const ok = await confirmDialog('예시 단어 지우기', `예시 단어 ${count}개를 삭제할까요?\n(직접 등록하거나 덮어쓴 단어는 남습니다)`, '삭제', true);
  if (!ok) return;
  state.words = state.words.filter(w => !w.sample);
  saveWords();
  pruneLibraryWordIds();
  saveLibraries();
  showToast(`예시 단어 ${count}개를 삭제했습니다.`);
}
