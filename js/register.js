/* ============================================================
 * register.js — 단어 하나 등록 화면
 *  - 영단어 자동완성(단어 + 난이도 + 품사별 뜻), 고르면 뜻이 칩으로 채워짐
 *  - 한글을 입력하면 뜻으로 영단어 찾기 (포기하다 → abandon)
 *  - 뜻 칩: 눌러서 빼기, 직접 입력해 추가 (사용자가 고친 뜻이 사전 뜻보다 우선)
 *  - 입력 중 중복 표시, 사전에 없으면 온라인 참고(영영 뜻·참고용 번역·네이버 사전)
 *  - "방금 등록한 단어" 최근 10개 + 되돌리기
 * ============================================================ */

let acItems = [];        // 지금 보이는 자동완성 후보
let acIndex = -1;        // 화살표 키로 고른 후보
let chips = [];          // 뜻 칩
let chipsSource = null;  // 'dict'(사전에서 채움) | 'user'(사용자가 고침)
let chipsWord = '';      // 사전 뜻을 채운 단어 (단어를 바꾸면 사전 뜻은 비움)
let fallbackTimer = null;
let fallbackSeq = 0;     // 온라인 조회 순서 (늦게 도착한 예전 응답은 무시)
let recentAdds = [];     // 방금 등록한 단어 [{ key, wordId, word, meanings, kind, before, libId, libName, at }]

/* ---------- 뜻 칩 ---------- */

function renderChips() {
  $('#meaning-chips').innerHTML = chips.map((m, i) =>
    `<button type="button" class="mchip" data-i="${i}" aria-label="${escapeHtml(m)} 빼기">${escapeHtml(m)}<span aria-hidden="true">✕</span></button>`
  ).join('');
  $('#add-meaning').placeholder = chips.length ? '뜻 더 추가' : '뜻 입력 후 Enter (쉼표로 여러 개)';
}

function setChips(list, source, word = '') {
  chips = [...new Set(list)];
  chipsSource = chips.length ? source : null;
  chipsWord = word;
  renderChips();
}

/** 직접 입력한 뜻을 칩으로 추가. 추가했으면 true */
function addChipsFromText(text) {
  const parts = splitMeanings(text);
  if (!parts.length) return false;
  parts.forEach(p => { if (!chips.includes(p)) chips.push(p); });
  chipsSource = 'user';
  renderChips();
  return true;
}

function removeChip(i) {
  chips.splice(i, 1);
  chipsSource = chips.length ? 'user' : null;
  renderChips();
}

/* ---------- 자동완성 ---------- */

function hideSuggestions() {
  $('#ac-list').hidden = true;
  $('#add-word').setAttribute('aria-expanded', 'false');
  acIndex = -1;
}

/** 후보의 뜻 표시: 사전 단어는 품사별로(동 버리다, 포기하다 · 명 방종), 내 단어는 내가 쓴 뜻 */
function suggestionMeaningHtml(it) {
  if (it.mine || !it.senses || !it.senses.length) return escapeHtml(it.meanings.slice(0, 3).join(', '));
  return it.senses.slice(0, 3).map(s => {
    const ms = s.meanings.slice(0, 2).map(m => (m === it.matched ? `<mark>${escapeHtml(m)}</mark>` : escapeHtml(m)));
    if (it.matched && s.meanings.includes(it.matched) && !s.meanings.slice(0, 2).includes(it.matched)) ms.unshift(`<mark>${escapeHtml(it.matched)}</mark>`);
    return `<span class="ac-sense">${POS_LABEL[s.pos] ? `<span class="pos">${POS_LABEL[s.pos]}</span> ` : ''}${ms.join(', ')}</span>`;
  }).join('');
}

function renderSuggestions() {
  const val = $('#add-word').value;
  acItems = val.trim() ? dictSuggest(val, 6) : [];
  acIndex = -1;
  // 이미 고른 단어 하나만 남았으면 목록을 띄우지 않음
  const onlyChosen = acItems.length === 1 && chipsSource && wordKey(acItems[0].word) === wordKey(val);
  if (!acItems.length || onlyChosen) { hideSuggestions(); return; }
  $('#ac-list').innerHTML = acItems.map((it, i) => `
    <li role="option" id="ac-opt-${i}">
      <button type="button" class="ac-item" data-i="${i}">
        <span class="ac-top">
          <b class="ac-word">${escapeHtml(it.word)}</b>${levelBadgeHtml(it.word)}
          ${it.from ? `<span class="ac-note">← ${escapeHtml(it.from)}</span>` : ''}
          ${(it.notes || []).map(n => `<span class="ac-note">${escapeHtml(n)}</span>`).join('')}
          ${it.mine ? '<span class="ac-note">내 단어</span>' : ''}
        </span>
        <span class="ac-mean">${suggestionMeaningHtml(it)}</span>
      </button>
    </li>`).join('');
  $('#ac-list').hidden = false;
  $('#add-word').setAttribute('aria-expanded', 'true');
}

function highlightSuggestion(i) {
  acIndex = i;
  $$('#ac-list .ac-item').forEach((b, j) => b.classList.toggle('active', j === i));
  $('#add-word').setAttribute('aria-activedescendant', i >= 0 ? `ac-opt-${i}` : '');
}

/** 후보 고르기: 단어와 뜻 채우기 (사용자가 직접 고친 뜻이 있으면 유지) */
function applyEntry(entry) {
  $('#add-word').value = entry.word;
  if (!chips.length || chipsSource !== 'user') setChips(entry.meanings, 'dict', wordKey(entry.word));
  hideSuggestions();
  hideFallback();
  updateWordStatus();
}

function selectSuggestion(i) {
  const it = acItems[i];
  if (!it) return;
  applyEntry(it);
  $('#add-word').focus();
}

/** 입력 중 표시: "이미 있음 · 라이브러리 이름" 또는 "원형 study", "leave의 과거·과거분사" */
function updateWordStatus(extra = '') {
  const el = $('#add-word-status');
  const val = $('#add-word').value.trim();
  const ex = val ? findWord(val) : null;
  el.className = 'word-status';
  if (ex) {
    const libs = librariesOfWord(ex.id).map(l => l.name);
    el.textContent = `이미 있음 · ${libs.length ? libs.join(', ') : '모든 단어'}`;
    el.classList.add('dup');
  } else if (extra) {
    el.textContent = extra;
  } else if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(val)) {
    el.textContent = acItems.length ? '한글 뜻으로 찾은 영단어예요 · 골라 주세요' : '';
  } else {
    const hit = val ? dictLookup(val) : null;
    const notes = hit && !hit.from ? inflectionNotes(hit.entry.word) : [];
    el.textContent = hit && hit.from ? `${hit.from} → 원형 "${hit.entry.word}"`
      : notes.length ? `${hit.entry.word}: ${notes.join(', ')}이기도 해요` : '';
  }
  el.hidden = !el.textContent;
}

/* ---------- 사전에 없을 때: 온라인 참고 ---------- */

function hideFallback() {
  clearTimeout(fallbackTimer);
  fallbackSeq++;
  $('#dict-fallback').hidden = true;
}

/** 입력이 멈추면 사전에 없는 단어인지 확인해 온라인 참고를 띄움 */
function scheduleFallback() {
  clearTimeout(fallbackTimer);
  fallbackTimer = setTimeout(() => {
    const v = $('#add-word').value.trim();
    // 자동완성 후보가 있으면(입력 중인 접두사) 사전에 없는 단어로 보지 않음, 한글은 온라인에서 찾지 않음
    if (v.length >= 3 && !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(v) && !acItems.length && !dictLookup(v) && !findWord(v) && !chips.length) showFallback(v);
  }, 900);
}

/**
 * 영영 뜻(Free Dictionary) + 참고용 번역(MyMemory) + 네이버 사전 링크
 * 인터넷이 없거나 둘 다 실패하면 조용히 숨기고 직접 입력하게 둠
 */
async function showFallback(word) {
  clearTimeout(fallbackTimer);
  const seq = ++fallbackSeq;
  const box = $('#dict-fallback');
  box.hidden = true;
  if (!navigator.onLine) return;
  updateWordStatus('사전에 없는 단어 · 온라인에서 찾는 중…');
  const [trans, defs] = await Promise.allSettled([fetchReferenceTranslation(word), fetchEnglishDefinitions(word)]);
  if (seq !== fallbackSeq) return; // 그 사이 다른 단어를 입력함
  updateWordStatus();
  const t = trans.status === 'fulfilled' ? trans.value : null;
  const d = defs.status === 'fulfilled' ? defs.value : [];
  if (!t && !d.length) return;

  const transHtml = t ? `
    <div class="fb-row"><span class="fb-label">참고용 번역</span>
      ${splitMeanings(t).slice(0, 3).map(m => `<button type="button" class="suggest-chip" data-m="${escapeHtml(m)}">＋ ${escapeHtml(m)}</button>`).join('')}
    </div>` : '';
  const defsHtml = d.length ? `
    <div class="fb-row"><span class="fb-label">영영 뜻</span>
      <ol class="fb-defs">${d.map(x => `<li><i>${escapeHtml(x.pos)}</i> ${escapeHtml(x.def)}</li>`).join('')}</ol>
    </div>` : '';
  box.innerHTML = `
    <p class="fb-title">사전에 없는 단어예요 · <b>${escapeHtml(word)}</b></p>
    ${transHtml}${defsHtml}
    <div class="fb-actions">
      <a class="btn btn-small" href="${naverDictUrl(word)}" target="_blank" rel="noopener">네이버 사전</a>
      <button type="button" class="btn btn-small" data-fb="manual">직접 입력</button>
    </div>`;
  box.hidden = false;
}

/* ---------- 등록 ---------- */

/** 폼 비우기 (다음 단어를 바로 입력할 수 있게) */
function resetAddForm() {
  $('#add-word').value = '';
  $('#add-meaning').value = '';
  $('#add-memo').value = '';
  setChips([], null);
  hideSuggestions();
  hideFallback();
  updateWordStatus();
}

async function handleAddSubmit(e) {
  if (e) e.preventDefault();
  const wordInput = $('#add-word');
  let word = wordInput.value.trim();
  // 뜻 입력칸에 남은 글자도 칩으로
  addChipsFromText($('#add-meaning').value);
  $('#add-meaning').value = '';

  if (!word) { showToast('영단어를 입력하세요.'); wordInput.focus(); return; }
  // 한글을 입력한 채로 등록하면: 뜻으로 찾은 첫 단어를 고르게 함
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(word)) {
    const found = dictReverse(word, 1)[0];
    if (found && !chips.length) { applyEntry(withUserMeanings(found)); showToast(`"${found.word}"(으)로 채웠어요. 확인 후 등록하세요.`); return; }
    showToast('영단어를 입력하세요. (한글 뜻으로 찾으면 목록에서 골라 주세요)');
    wordInput.focus();
    return;
  }
  // 뜻이 비어 있으면 사전에서 채워서 바로 등록
  if (!chips.length) {
    const hit = dictLookup(word);
    if (hit) {
      const entry = withUserMeanings(hit.entry);
      word = entry.word;
      setChips(entry.meanings, 'dict', wordKey(word));
    }
  }
  if (!chips.length) { showToast('뜻을 입력하세요.'); $('#add-meaning').focus(); return; }

  const meanings = chips.slice();
  const memo = $('#add-memo').value;
  const target = resolveAddLibrary();
  const existing = findWord(word);
  let rec;
  let msg;

  if (existing) {
    const same = existing.meanings.join('|') === meanings.join('|') && (!memo.trim() || memo.trim() === existing.memo);
    if (same) {
      // 뜻이 같으면 덮어쓸 필요 없이 라이브러리에만 담음
      rec = existing;
      msg = `"${existing.word}"은(는) 이미 있어요`;
      if (target && !target.wordIds.includes(rec.id)) rememberRecentAdd(rec, 'link', null, target);
    } else {
      const ok = await confirmDialog(
        '이미 있는 단어',
        `"${existing.word}"은(는) 이미 등록되어 있습니다.\n\n기존 뜻: ${existing.meanings.join(', ')}\n새 뜻: ${meanings.join(', ')}\n\n덮어쓸까요? (학습 통계는 유지됩니다)`,
        '덮어쓰기'
      );
      if (!ok) return;
      const before = JSON.parse(JSON.stringify(existing));
      overwriteWord(existing, { word, meanings, memo });
      saveWords();
      rememberRecentAdd(existing, 'overwrite', before, target);
      rec = existing;
      msg = `"${word}" 덮어썼습니다`;
    }
  } else {
    rec = createWordRecord({ word, meanings, memo });
    state.words.push(rec);
    saveWords();
    rememberRecentAdd(rec, 'new', null, target);
    msg = `"${word}" 등록했습니다`;
  }
  const lib = addToTargetLibrary([rec.id]);
  showToast(msg + (lib ? ` → ${lib.name}` : ''));

  resetAddForm();
  renderAddLibrarySelect();
  renderRecentAdds();
  wordInput.focus();
}

/* ---------- 방금 등록한 단어 (되돌리기) ---------- */

function loadRecentAdds() {
  const list = readJSON(STORAGE_KEYS.recentAdds, []);
  recentAdds = Array.isArray(list) ? list.filter(r => r && r.key && r.wordId) : [];
}

function saveRecentAdds() {
  writeJSON(STORAGE_KEYS.recentAdds, recentAdds);
}

/**
 * 등록 기록 남기기 (라이브러리에 넣기 "전에" 불러야 원래 없었는지 알 수 있음)
 * @param kind 'new' 새 단어 | 'overwrite' 덮어씀 | 'link' 라이브러리에만 담음
 */
function rememberRecentAdd(rec, kind, before, lib) {
  const libId = lib && !lib.wordIds.includes(rec.id) ? lib.id : null;
  if (kind === 'link' && !libId) return;
  recentAdds.unshift({
    key: makeId(), wordId: rec.id, word: rec.word, meanings: rec.meanings.slice(),
    kind, before, libId, libName: lib ? lib.name : '', at: Date.now()
  });
  recentAdds = recentAdds.slice(0, 10);
  saveRecentAdds();
}

/** 등록 되돌리기: 새 단어는 삭제, 덮어쓴 단어는 예전 뜻으로, 담은 라이브러리에서는 뺌 */
function undoRecentAdd(key) {
  const r = recentAdds.find(x => x.key === key);
  if (!r) return;
  const cur = getWordById(r.wordId);
  if (cur) {
    if (r.kind === 'new') {
      deleteWord(r.wordId);
    } else {
      if (r.kind === 'overwrite' && r.before) {
        // 뜻·메모만 예전으로 (그 뒤에 쌓인 학습 기록은 유지)
        Object.assign(cur, { word: r.before.word, meanings: r.before.meanings, memo: r.before.memo, sample: !!r.before.sample });
        saveWords();
      }
      if (r.libId) removeWordFromLibrary(r.libId, r.wordId);
    }
  }
  recentAdds = recentAdds.filter(x => x.key !== key);
  saveRecentAdds();
  renderRecentAdds();
  renderAddLibrarySelect();
  updateWordStatus();
  showToast(`"${r.word}" 등록을 되돌렸습니다.`);
}

function renderRecentAdds() {
  // 그 사이 다른 곳에서 지운 단어는 목록에서 뺌
  recentAdds = recentAdds.filter(r => getWordById(r.wordId));
  const kindText = { new: '', overwrite: '덮어씀', link: '담기만' };
  $('#recent-adds').innerHTML = recentAdds.map(r => `
    <li class="recent-item">
      <div class="recent-main">
        <b>${escapeHtml(r.word)}</b> <span>${escapeHtml(r.meanings.join(', '))}</span>
        <small>${[kindText[r.kind], r.libId ? `→ ${escapeHtml(r.libName)}` : ''].filter(Boolean).join(' ')}</small>
      </div>
      <button type="button" class="btn btn-small" data-undo="${r.key}">되돌리기</button>
    </li>`).join('');
  $('#recent-card').hidden = recentAdds.length === 0;
}

/* ---------- 이벤트 ---------- */

function handleWordKeydown(e) {
  const listOpen = !$('#ac-list').hidden;
  if (e.key === 'ArrowDown' && listOpen) {
    e.preventDefault();
    highlightSuggestion(Math.min(acItems.length - 1, acIndex + 1));
  } else if (e.key === 'ArrowUp' && listOpen) {
    e.preventDefault();
    highlightSuggestion(Math.max(-1, acIndex - 1));
  } else if (e.key === 'Escape') {
    hideSuggestions();
  } else if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    if (listOpen && acIndex >= 0) { selectSuggestion(acIndex); return; }
    // 뜻이 채워져 있으면 Enter 한 번으로 등록
    if (chips.length || $('#add-meaning').value.trim()) { handleAddSubmit(); return; }
    const val = e.target.value.trim();
    if (!val) return;
    // 한글로 찾는 중이면 첫 후보를 고름
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(val)) { if (acItems.length) selectSuggestion(0); return; }
    const hit = dictLookup(val);
    if (hit) { applyEntry(withUserMeanings(hit.entry)); return; } // 뜻을 채우고, 다음 Enter로 등록
    // 사전에 없는 단어 → 온라인 참고 + 뜻 직접 입력
    hideSuggestions();
    showFallback(val);
    $('#add-meaning').focus();
  }
}

function handleMeaningKeydown(e) {
  const input = e.target;
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    addChipsFromText(input.value);
    input.value = '';
    if ($('#add-word').value.trim()) handleAddSubmit();
    else $('#add-word').focus();
  } else if (e.key === 'Backspace' && !input.value && chips.length) {
    removeChip(chips.length - 1);
  }
}

function initAddView() {
  loadRecentAdds();
  const wordInput = $('#add-word');
  const meaningInput = $('#add-meaning');

  $('#add-form').addEventListener('submit', handleAddSubmit);
  $('#bulk-add-btn').addEventListener('click', handleBulkAdd);
  $('#add-library').addEventListener('change', handleAddLibraryChange);

  wordInput.addEventListener('input', () => {
    // 사전에서 채운 뜻은 단어를 바꾸면 비움 (직접 고친 뜻은 유지)
    if (chipsSource === 'dict' && wordKey(wordInput.value) !== chipsWord) setChips([], null);
    renderSuggestions();
    updateWordStatus();
    hideFallback();
    scheduleFallback();
  });
  wordInput.addEventListener('keydown', handleWordKeydown);
  wordInput.addEventListener('blur', () => setTimeout(hideSuggestions, 150));

  // 후보를 눌러도 입력칸 포커스(키보드)가 유지되게
  $('#ac-list').addEventListener('pointerdown', e => e.preventDefault());
  $('#ac-list').addEventListener('mousedown', e => e.preventDefault());
  $('#ac-list').addEventListener('click', e => {
    const b = e.target.closest('.ac-item');
    if (b) selectSuggestion(Number(b.dataset.i));
  });

  meaningInput.addEventListener('keydown', handleMeaningKeydown);
  // 쉼표를 치면 앞부분을 칩으로
  meaningInput.addEventListener('input', () => {
    if (!/[,，]/.test(meaningInput.value)) return;
    const parts = meaningInput.value.split(/[,，]/);
    const rest = parts.pop();
    addChipsFromText(parts.join(','));
    meaningInput.value = rest;
  });
  $('#meaning-chips').addEventListener('click', e => {
    const c = e.target.closest('.mchip');
    if (c) { removeChip(Number(c.dataset.i)); meaningInput.focus(); }
  });
  $('#meaning-box').addEventListener('click', e => { if (e.target.id === 'meaning-box') meaningInput.focus(); });

  $('#dict-fallback').addEventListener('click', e => {
    const s = e.target.closest('.suggest-chip');
    if (s) { addChipsFromText(s.dataset.m); s.disabled = true; return; }
    if (e.target.closest('[data-fb="manual"]')) { hideFallback(); meaningInput.focus(); }
  });

  $('#recent-adds').addEventListener('click', e => {
    const b = e.target.closest('[data-undo]');
    if (b) undoRecentAdd(b.dataset.undo);
  });

  renderChips();
  renderRecentAdds();
}
