/* ============================================================
 * words.js — 단어 데이터 조작 + 단어 등록 화면
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

/* ---------- 저장할 라이브러리 ---------- */

/** 등록 화면의 '저장할 라이브러리' 선택 상자 갱신 */
function renderAddLibrarySelect() {
  fillLibrarySelect($('#add-library'), { selected: state.settings.addLibrary, includeNone: true, includeNew: true });
}

/** 선택된 라이브러리에 단어 넣기. 넣은 라이브러리 이름 반환 (없으면 '') */
function addToTargetLibrary(wordIds) {
  const lib = getLibrary(state.settings.addLibrary);
  if (!lib || wordIds.length === 0) return '';
  addWordsToLibrary(lib.id, wordIds);
  return lib.name;
}

async function handleAddLibraryChange(e) {
  if (e.target.value === '__new__') {
    const lib = await openLibraryDialog();
    state.settings.addLibrary = lib ? lib.id : state.settings.addLibrary;
  } else {
    state.settings.addLibrary = e.target.value;
  }
  saveSettings();
  renderAddLibrarySelect();
}

/* ---------- 단어 하나 등록 ---------- */

async function handleAddSubmit(e) {
  e.preventDefault();
  const wordInput = $('#add-word');
  const meaningInput = $('#add-meaning');
  const memoInput = $('#add-memo');

  const word = wordInput.value.trim();
  const meanings = splitMeanings(meaningInput.value);
  const memo = memoInput.value;

  if (!word) { showToast('영단어를 입력하세요.'); wordInput.focus(); return; }
  if (meanings.length === 0) { showToast('뜻을 입력하세요.'); meaningInput.focus(); return; }

  const existing = findWord(word);
  if (existing) {
    const ok = await confirmDialog(
      '이미 있는 단어',
      `"${existing.word}"은(는) 이미 등록되어 있습니다.\n\n기존 뜻: ${existing.meanings.join(', ')}\n새 뜻: ${meanings.join(', ')}\n\n덮어쓸까요? (학습 통계는 유지됩니다)`,
      '덮어쓰기'
    );
    if (!ok) return;
    overwriteWord(existing, { word, meanings, memo });
    saveWords();
    const libName = addToTargetLibrary([existing.id]);
    showToast(`"${word}" 덮어썼습니다.` + (libName ? ` → ${libName}` : ''));
  } else {
    const rec = createWordRecord({ word, meanings, memo });
    state.words.push(rec);
    saveWords();
    const libName = addToTargetLibrary([rec.id]);
    showToast(`"${word}" 등록했습니다.` + (libName ? ` → ${libName}` : ''));
  }
  renderAddLibrarySelect(); // 단어 수 갱신

  // 다음 단어를 바로 입력할 수 있게 비우고 포커스
  wordInput.value = '';
  meaningInput.value = '';
  memoInput.value = '';
  wordInput.focus();
}

/* ---------- 일괄 등록 ---------- */

/**
 * "word - 뜻" 형식 텍스트 해석
 *  - 구분자: " - " (공백 포함 하이픈), 탭, " : "  → 하이픈이 들어간 단어(well-known)도 안전
 *  - 위 구분자가 없으면 첫 번째 "-" 로 나눔 (예: "apple-사과")
 * @returns {{items: Array<{word, meanings}>, errors: string[]}}
 */
function parseBulkText(text) {
  const items = [];
  const errors = [];
  const lines = String(text).split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    let m = line.match(/^(.+?)\s+[-–—:]\s+(.+)$/) || line.match(/^(.+?)\t+(.+)$/) || line.match(/^([^-]+?)\s*-\s*(.+)$/);
    if (!m) { errors.push(`${idx + 1}번째 줄: "${line}"`); return; }
    const word = m[1].trim();
    const meanings = splitMeanings(m[2]);
    if (!word || meanings.length === 0) { errors.push(`${idx + 1}번째 줄: "${line}"`); return; }
    items.push({ word, meanings });
  });

  // 같은 붙여넣기 안에서 중복된 단어는 마지막 줄 기준으로 하나만 남김
  const map = new Map();
  items.forEach(it => map.set(wordKey(it.word), it));
  return { items: Array.from(map.values()), errors };
}

async function handleBulkAdd() {
  const textarea = $('#bulk-input');
  const { items, errors } = parseBulkText(textarea.value);

  if (items.length === 0) {
    showToast(errors.length ? '형식이 맞는 줄이 없습니다. "word - 뜻" 형식을 확인하세요.' : '입력된 내용이 없습니다.');
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

  const newIds = fresh.map(it => { const rec = createWordRecord(it); state.words.push(rec); return rec.id; });
  if (overwrite) dupes.forEach(it => overwriteWord(findWord(it.word), it));
  saveWords();
  // 건너뛴 기존 단어도 선택한 라이브러리에는 넣어 줌 (뜻은 그대로)
  const libName = addToTargetLibrary([...newIds, ...dupes.map(it => findWord(it.word).id)]);
  renderAddLibrarySelect();

  let msg = `새 단어 ${fresh.length}개 등록`;
  if (dupes.length) msg += overwrite ? `, ${dupes.length}개 덮어씀` : `, ${dupes.length}개 건너뜀`;
  if (libName) msg += ` → ${libName}`;
  textarea.value = '';

  if (errors.length) {
    // 형식이 틀린 줄은 다시 고칠 수 있게 입력칸에 남겨 둠
    textarea.value = errors.map(e => e.replace(/^\d+번째 줄: "(.*)"$/, '$1')).join('\n');
    await showDialog({
      title: msg,
      message: `다음 ${errors.length}줄은 형식이 맞지 않아 등록하지 못했습니다. 입력칸에 남겨 두었으니 고쳐서 다시 등록하세요.\n\n${errors.slice(0, 20).join('\n')}`
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

function initAddView() {
  $('#add-form').addEventListener('submit', handleAddSubmit);
  $('#bulk-add-btn').addEventListener('click', handleBulkAdd);
  $('#add-library').addEventListener('change', handleAddLibraryChange);
  // 영단어 입력 후 Enter → 뜻 입력칸으로 이동
  $('#add-word').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#add-meaning').focus(); }
  });
}
