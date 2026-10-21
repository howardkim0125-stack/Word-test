/* ============================================================
 * libraries.js — 라이브러리 (스포티파이 플레이리스트처럼 단어 묶음)
 *  - 단어는 하나만 저장하고, 라이브러리는 단어 ID 목록만 가짐
 *  - 한 단어가 여러 라이브러리에 들어갈 수 있음
 *  - 'all' = 모든 단어, 'auto:…' = 자동 목록 (둘 다 가상의 라이브러리, review.js)
 * ============================================================ */

// 표지 색 (그라데이션 두 색)
const LIB_COLORS = [
  ['#4f46e5', '#a855f7'],
  ['#059669', '#34d399'],
  ['#ea580c', '#facc15'],
  ['#db2777', '#f472b6'],
  ['#0284c7', '#38bdf8'],
  ['#7c3aed', '#ec4899'],
  ['#334155', '#94a3b8'],
  ['#b91c1c', '#f97316']
];

// 지금 열려 있는 라이브러리 ('all' 또는 라이브러리 ID)
let currentLibId = 'all';

// ＋ 버튼으로 담는 기본 라이브러리 (스포티파이의 '좋아요 표시한 곡'처럼)
const DEFAULT_LIB_NAME = '외울 단어';

/* ---------- 데이터 조작 ---------- */

function getLibrary(id) {
  return state.libraries.find(l => l.id === id) || null;
}

/** 라이브러리에 든 단어 목록 ('all'이면 전체, 자동 목록은 지금 데이터로 계산) */
function libraryWords(libId) {
  if (libId === 'all') return state.words;
  if (isAutoList(libId)) return autoListWords(libId);
  const lib = getLibrary(libId);
  if (!lib) return [];
  const ids = new Set(lib.wordIds);
  return state.words.filter(w => ids.has(w.id));
}

/** 라이브러리(또는 '모든 단어', 자동 목록)가 있는지 */
function libraryExists(libId) {
  return libId === 'all' || !!getAutoList(libId) || !!getLibrary(libId);
}

function libraryName(libId) {
  if (libId === 'all') return '모든 단어';
  if (isAutoList(libId)) return getAutoList(libId)?.name || '자동 목록';
  return getLibrary(libId)?.name || '(삭제된 라이브러리)';
}

/** 단어가 들어 있는 라이브러리 목록 */
function librariesOfWord(wordId) {
  return state.libraries.filter(l => l.wordIds.includes(wordId));
}

/** 기본 라이브러리 (설정에서 고른 것). 아직 없으면 null */
function getDefaultLibrary() {
  return getLibrary(state.settings.defaultLibrary);
}

/** 기본 라이브러리를 가져오고, 없으면 "외울 단어"를 만들어 기본으로 지정 */
function ensureDefaultLibrary() {
  let lib = getDefaultLibrary();
  if (lib) return lib;
  lib = state.libraries.find(l => l.name === DEFAULT_LIB_NAME) ||
    createLibrary({ name: DEFAULT_LIB_NAME, desc: '＋ 버튼으로 담은 단어', color: 3 });
  state.settings.defaultLibrary = lib.id;
  saveSettings();
  return lib;
}

function defaultLibraryName() {
  return getDefaultLibrary()?.name || DEFAULT_LIB_NAME;
}

/** 라이브러리를 방금 썼다고 표시 (담기 시트에서 맨 위로) */
function touchLibrary(libId) {
  const lib = getLibrary(libId);
  if (!lib) return;
  lib.lastUsedAt = Date.now();
  saveLibraries();
}

function createLibrary({ name, desc = '', color = null, packId = null }) {
  const lib = normalizeLibrary({
    name,
    desc,
    color: color ?? state.libraries.length % LIB_COLORS.length,
    wordIds: [],
    packId
  });
  state.libraries.push(lib);
  saveLibraries();
  return lib;
}

/** 라이브러리에 단어 넣기 (이미 있으면 무시). 새로 넣은 개수 반환 */
function addWordsToLibrary(libId, wordIds) {
  const lib = getLibrary(libId);
  if (!lib) return 0;
  const set = new Set(lib.wordIds);
  let added = 0;
  wordIds.forEach(id => { if (!set.has(id)) { set.add(id); added++; } });
  lib.wordIds = Array.from(set);
  saveLibraries();
  return added;
}

function removeWordFromLibrary(libId, wordId) {
  const lib = getLibrary(libId);
  if (!lib) return;
  lib.wordIds = lib.wordIds.filter(id => id !== wordId);
  saveLibraries();
}

/** 단어를 완전히 삭제할 때 모든 라이브러리에서도 빼기 */
function removeWordFromAllLibraries(wordId) {
  state.libraries.forEach(l => { l.wordIds = l.wordIds.filter(id => id !== wordId); });
  saveLibraries();
}

/**
 * 라이브러리 삭제
 * @param {boolean} withWords true면 다른 라이브러리에 없는 단어까지 삭제
 */
function deleteLibrary(libId, withWords) {
  const lib = getLibrary(libId);
  if (!lib) return 0;
  state.libraries = state.libraries.filter(l => l.id !== libId);
  let removed = 0;
  if (withWords) {
    const inOthers = new Set(state.libraries.flatMap(l => l.wordIds));
    const toDelete = new Set(lib.wordIds.filter(id => !inOthers.has(id)));
    removed = toDelete.size;
    state.words = state.words.filter(w => !toDelete.has(w.id));
    saveWords();
  }
  saveLibraries();
  if (state.settings.testLibrary === libId) state.settings.testLibrary = 'all';
  state.settings.testScope = state.settings.testScope.filter(x => x !== libId);
  if (!state.settings.testScope.length) state.settings.testScope = ['all'];
  delete state.settings.scopeSettings[libId];
  if (state.settings.addLibrary === libId) state.settings.addLibrary = '__default__';
  if (state.settings.defaultLibrary === libId) state.settings.defaultLibrary = ''; // 다음에 담을 때 다시 만듦
  saveSettings();
  return removed;
}

/**
 * 추천 단어팩을 내 라이브러리로 추가
 *  - 이미 있는 단어는 뜻을 바꾸지 않고 라이브러리에만 연결
 */
function installPack(pack) {
  const lib = createLibrary({ name: pack.name, desc: pack.desc, color: pack.color, packId: pack.id });
  let created = 0;
  const ids = packWordList(pack).map(item => {
    const existing = findWord(item.word);
    if (existing) {
      existing.sample = false; // 단어팩에 들어간 단어는 '예시 단어 지우기'로 지워지지 않게
      return existing.id;
    }
    const rec = createWordRecord(item);
    state.words.push(rec);
    created++;
    return rec.id;
  });
  saveWords();
  addWordsToLibrary(lib.id, ids);
  return { lib, created, linked: ids.length - created };
}

function installedLibraryOfPack(packId) {
  return state.libraries.find(l => l.packId === packId) || null;
}

/* ---------- 화면: 공용 ---------- */

/** 표지 HTML (그라데이션 + 이름) */
function coverHtml({ name, color }, extraClass = '') {
  const [c1, c2] = LIB_COLORS[(color ?? 0) % LIB_COLORS.length];
  return `<div class="lib-cover ${extraClass}" style="background:linear-gradient(135deg, ${c1}, ${c2})">
    <span>${escapeHtml(name)}</span></div>`;
}

const ALL_COVER = { name: '모든 단어', color: 6 };

/** select 요소에 라이브러리 목록 채우기 */
function fillLibrarySelect(select, { selected, includeAll = false, includeNone = false, includeNew = false }) {
  const opts = [];
  if (includeAll) opts.push(`<option value="all">모든 단어 (${state.words.length})</option>`);
  if (includeNone) opts.push('<option value="">라이브러리 없이 (모든 단어에만)</option>');
  state.libraries.forEach(l => opts.push(`<option value="${l.id}">${escapeHtml(l.name)} (${l.wordIds.length})</option>`));
  if (includeNew) opts.push('<option value="__new__">＋ 새 라이브러리 만들기…</option>');
  select.innerHTML = opts.join('');
  select.value = selected;
  if (select.value !== selected) select.selectedIndex = 0; // 선택값이 사라졌으면 첫 항목
}

/* ---------- 화면: 라이브러리 홈 ---------- */

function renderLibraryHome() {
  const cards = [
    `<button class="lib-card" data-lib="all">
      ${coverHtml(ALL_COVER)}
      <span class="lib-card-name">모든 단어</span>
      <span class="lib-card-meta">단어 ${state.words.length}개</span>
      ${masteryBarHtml(state.words)}
    </button>`,
    ...state.libraries.map(l => `
      <button class="lib-card" data-lib="${l.id}">
        ${coverHtml(l)}
        <span class="lib-card-name">${escapeHtml(l.name)}</span>
        <span class="lib-card-meta">${l.packId ? '단어팩 · ' : ''}단어 ${l.wordIds.length}개</span>
        ${masteryBarHtml(libraryWords(l.id))}
      </button>`)
  ];
  $('#lib-grid').innerHTML = cards.join('');

  // 자동 목록: 항상 지금 데이터로 계산
  $('#auto-grid').innerHTML = AUTO_LISTS.map(a => `
    <button class="lib-card auto-card" data-lib="${a.id}">
      ${coverHtml({ name: `${a.icon} ${a.name}`, color: a.color }, 'lib-cover-auto')}
      <span class="lib-card-name">${escapeHtml(a.name)}</span>
      <span class="lib-card-meta">단어 ${autoListWords(a.id).length}개</span>
    </button>`).join('');

  $('#pack-grid').innerHTML = WORD_PACKS.map(p => {
    const installed = installedLibraryOfPack(p.id);
    return `
      <button class="lib-card" data-pack="${p.id}">
        ${coverHtml(p)}
        <span class="lib-card-name">${escapeHtml(p.name)}</span>
        <span class="lib-card-meta">${installed ? '✓ 추가됨 · ' : ''}단어 ${packWordList(p).length}개</span>
      </button>`;
  }).join('');
}

function showLibraryHome() {
  $('#lib-home').hidden = false;
  $('#lib-detail').hidden = true;
  renderLibraryHome();
}

/* ---------- 화면: 라이브러리 상세 ---------- */

function openLibrary(libId) {
  if (!libraryExists(libId)) libId = 'all';
  if (typeof exitSelectMode === 'function') exitSelectMode(false);
  currentLibId = libId;
  $('#lib-home').hidden = true;
  $('#lib-detail').hidden = false;
  $('#list-search').value = '';
  renderLibraryHero();
  renderList();
  renderRecommendations(true);
  window.scrollTo(0, 0);
}

function renderLibraryHero() {
  const isAll = currentLibId === 'all';
  const auto = getAutoList(currentLibId);
  const lib = isAll || auto ? null : getLibrary(currentLibId);
  const info = isAll ? ALL_COVER : auto ? { name: `${auto.icon} ${auto.name}`, color: auto.color } : lib;
  $('#lib-hero-cover').outerHTML = coverHtml(info, 'lib-cover-large').replace('<div class="lib-cover', '<div id="lib-hero-cover" class="lib-cover');
  $('#lib-hero-kind').textContent = isAll ? '전체 단어장' : auto ? '자동 목록' : (lib.packId ? '단어팩 라이브러리' : '라이브러리');
  $('#lib-hero-name').textContent = auto ? auto.name : info.name;
  const words = libraryWords(currentLibId);
  const desc = isAll ? '등록한 모든 단어' : auto ? auto.desc : (lib.desc || '');
  $('#lib-hero-desc').textContent = [desc, `단어 ${words.length}개`].filter(Boolean).join(' · ');
  $('#lib-hero-progress').innerHTML = words.length ? masteryBarHtml(words, true) : '';
  // 마지막 시험
  const last = lastHistory(currentLibId);
  $('#lib-hero-last').textContent = last ? `마지막 시험: ${formatShortDate(last.at)} · ${scoreText(last)}` : '아직 시험 기록이 없어요';
  $('#lib-history-btn').hidden = !last;
  $('#lib-edit-btn').hidden = !lib;
  $('#lib-delete-btn').hidden = !lib;
  $('#lib-add-words-btn').hidden = !!auto;
  $('#lib-test-btn').disabled = words.length === 0;
  $('#lib-cards-btn').disabled = words.length === 0;
}

/** 새 라이브러리 / 편집 대화상자. 만든(수정한) 라이브러리 반환 */
async function openLibraryDialog(lib = null) {
  let color = lib ? lib.color : state.libraries.length % LIB_COLORS.length;
  const swatches = LIB_COLORS.map(([c1, c2], i) =>
    `<button type="button" class="swatch${i === color ? ' active' : ''}" data-color="${i}" style="background:linear-gradient(135deg, ${c1}, ${c2})" aria-label="색 ${i + 1}"></button>`
  ).join('');
  const html = `
    <label class="field"><span>이름</span>
      <input type="text" id="lib-name-input" maxlength="40" value="${escapeHtml(lib?.name || '')}" placeholder="예: 3월 모의고사 오답"></label>
    <label class="field"><span>설명 <small>(선택)</small></span>
      <input type="text" id="lib-desc-input" maxlength="80" value="${escapeHtml(lib?.desc || '')}"></label>
    <div class="field"><span>표지 색</span><div class="swatches">${swatches}</div></div>`;

  let values = null;
  const result = await showDialog({
    title: lib ? '라이브러리 편집' : '새 라이브러리',
    html,
    buttons: [
      { label: '취소', value: 'cancel' },
      { label: lib ? '저장' : '만들기', value: 'save', primary: true }
    ],
    onOpen: body => {
      body.querySelector('.swatches').addEventListener('click', e => {
        const b = e.target.closest('.swatch');
        if (!b) return;
        color = Number(b.dataset.color);
        body.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s === b));
      });
      $('#lib-name-input').focus();
    },
    beforeClose: v => {
      if (v !== 'save') return true;
      const name = $('#lib-name-input').value.trim();
      if (!name) { showToast('이름을 입력하세요.'); return false; }
      values = { name, desc: $('#lib-desc-input').value.trim(), color };
      return true;
    }
  });
  if (result !== 'save' || !values) return null;

  if (lib) {
    Object.assign(lib, values);
    saveLibraries();
    return lib;
  }
  return createLibrary(values);
}

async function confirmDeleteLibrary(libId) {
  const lib = getLibrary(libId);
  if (!lib) return;
  const inOthers = new Set(state.libraries.filter(l => l.id !== libId).flatMap(l => l.wordIds));
  const onlyHere = lib.wordIds.filter(id => !inOthers.has(id)).length;
  const choice = await showDialog({
    title: `"${lib.name}" 삭제`,
    message: `라이브러리만 지우면 단어는 '모든 단어'에 그대로 남습니다.\n이 라이브러리에만 들어 있는 단어: ${onlyHere}개`,
    buttons: [
      { label: '취소', value: null },
      { label: `단어 ${onlyHere}개도 삭제`, value: 'words', danger: true },
      { label: '라이브러리만 삭제', value: 'lib', primary: true }
    ]
  });
  if (!choice) return;
  const removed = deleteLibrary(libId, choice === 'words');
  showToast(choice === 'words' ? `라이브러리와 단어 ${removed}개를 삭제했습니다.` : '라이브러리를 삭제했습니다.');
  showLibraryHome();
}

/** 단어팩 미리보기 → 추가 */
async function openPackPreview(packId) {
  const pack = WORD_PACKS.find(p => p.id === packId);
  if (!pack) return;
  const items = packWordList(pack);
  const installed = installedLibraryOfPack(pack.id);
  const preview = items.slice(0, 12).map(it =>
    `<li><b>${escapeHtml(it.word)}</b> ${escapeHtml(it.meanings.join(', '))}</li>`).join('');
  const html = `
    <div class="pack-preview-head">${coverHtml(pack)}<div>
      <p class="hint">${escapeHtml(pack.desc)}<br>단어 ${items.length}개</p></div></div>
    <ul class="pack-preview">${preview}<li class="hint">… 외 ${Math.max(0, items.length - 12)}개</li></ul>
    <p class="hint">이미 등록된 단어는 뜻을 바꾸지 않고 라이브러리에만 연결합니다.
      <b>골라 담기</b>는 카드를 한 장씩 보며 모르는 단어만 새 라이브러리로 만들어요.</p>`;

  const choice = await showDialog({
    title: pack.name,
    html,
    buttons: [
      { label: '닫기', value: null },
      { label: '골라 담기 (카드)', value: 'pick' },
      installed
        ? { label: '라이브러리 열기', value: 'open', primary: true }
        : { label: '통째로 추가', value: 'install', primary: true }
    ]
  });
  if (choice === 'open') openLibrary(installed.id);
  if (choice === 'pick') startPackPicking(pack);
  if (choice === 'install') {
    const { lib, created, linked } = installPack(pack);
    showToast(`새 단어 ${created}개 추가${linked ? `, 기존 단어 ${linked}개 연결` : ''}`, 3000);
    openLibrary(lib.id);
  }
}

/**
 * 라이브러리 담기 시트 (스포티파이 "플레이리스트에 추가"처럼)
 *  - 체크하는 즉시 저장 (저장 버튼 없음), 최근 쓴 라이브러리가 맨 위, 맨 아래 "＋ 새 라이브러리"
 *  - 여러 단어를 한꺼번에 담을 수도 있음 (일부만 들어 있으면 체크 상자가 '-' 상태)
 */
async function openLibrarySheet(wordIds, after = () => {}) {
  const ids = [].concat(wordIds).filter(id => getWordById(id));
  if (!ids.length) return;
  const title = ids.length === 1 ? `"${getWordById(ids[0]).word}" 담기` : `단어 ${ids.length}개 담기`;
  const libs = state.libraries.slice().sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0) || b.createdAt - a.createdAt);
  const rows = libs.map(l => {
    const n = ids.filter(id => l.wordIds.includes(id)).length;
    return `
      <label class="check-row">
        <input type="checkbox" value="${l.id}" ${n === ids.length ? 'checked' : ''} ${n > 0 && n < ids.length ? 'data-partial="1"' : ''}>
        ${coverHtml(l, 'lib-cover-mini')}<span class="check-name">${escapeHtml(l.name)}</span>
        <span class="check-meta">${l.wordIds.length}</span>
      </label>`;
  }).join('');
  const html = `<div class="sheet-list">${rows || '<p class="hint">아직 라이브러리가 없습니다.</p>'}</div>
    <button type="button" class="btn btn-block" id="sheet-new-lib">＋ 새 라이브러리</button>`;

  let wantNew = false;
  await showDialog({
    title,
    html,
    buttons: [{ label: '완료', value: 'done', primary: true }],
    onOpen: body => {
      body.querySelectorAll('input[data-partial]').forEach(i => { i.indeterminate = true; });
      body.onchange = e => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        if (cb.checked) {
          addWordsToLibrary(cb.value, ids);
          touchLibrary(cb.value);
        } else {
          const lib = getLibrary(cb.value);
          lib.wordIds = lib.wordIds.filter(id => !ids.includes(id));
          saveLibraries();
        }
        after();
      };
      $('#sheet-new-lib').addEventListener('click', () => { wantNew = true; closeDialog(); });
    }
  });
  if (wantNew) {
    const lib = await openLibraryDialog();
    if (lib) {
      addWordsToLibrary(lib.id, ids);
      touchLibrary(lib.id);
      showToast(`${lib.name}에 담음`);
    }
  }
  after();
}

/**
 * ＋ 버튼: 첫 탭은 기본 라이브러리에 바로 담고 ✓로 바뀜.
 * 이미 담겨 있으면(✓) 담기 시트를 엶.
 */
function quickAddToDefault(wordId, after = () => {}) {
  const def = getDefaultLibrary();
  if (def && def.wordIds.includes(wordId)) { openLibrarySheet([wordId], after); return; }
  const lib = ensureDefaultLibrary();
  addWordsToLibrary(lib.id, [wordId]);
  touchLibrary(lib.id);
  after();
  showToast(`${lib.name}에 담음`, 4000, { label: '변경', onClick: () => openLibrarySheet([wordId], after) });
}

/** 단어가 기본 라이브러리에 있는지 (＋/✓ 표시용) */
function isInDefaultLibrary(wordId) {
  const def = getDefaultLibrary();
  return !!def && def.wordIds.includes(wordId);
}

/** 라이브러리 탭에 들어올 때 */
function onEnterLibraryView() {
  if ($('#lib-detail').hidden) renderLibraryHome();
  else if (!libraryExists(currentLibId)) showLibraryHome();
  else { renderLibraryHero(); renderList(); renderRecommendations(); }
}

function initLibraryView() {
  ['#lib-grid', '#auto-grid'].forEach(sel => $(sel).addEventListener('click', e => {
    const card = e.target.closest('[data-lib]');
    if (card) openLibrary(card.dataset.lib);
  }));
  $('#pack-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-pack]');
    if (card) openPackPreview(card.dataset.pack);
  });
  $('#new-lib-btn').addEventListener('click', async () => {
    const lib = await openLibraryDialog();
    if (lib) openLibrary(lib.id);
  });
  $('#lib-back-btn').addEventListener('click', showLibraryHome);
  $('#lib-edit-btn').addEventListener('click', async () => {
    const lib = await openLibraryDialog(getLibrary(currentLibId));
    if (lib) renderLibraryHero();
  });
  $('#lib-delete-btn').addEventListener('click', () => confirmDeleteLibrary(currentLibId));
  // ▶ 테스트: 이 라이브러리의 마지막 시험 설정으로 바로 시작
  $('#lib-test-btn').addEventListener('click', () => startScopeTest([currentLibId]));
  $('#lib-history-btn').addEventListener('click', () => openHistoryDialog(currentLibId));
  $('#lib-cards-btn').addEventListener('click', () => startFlashcards(currentLibId));
  $('#lib-add-words-btn').addEventListener('click', () => {
    state.settings.addLibrary = currentLibId === 'all' ? '' : currentLibId;
    saveSettings();
    switchTab('add');
  });
}
