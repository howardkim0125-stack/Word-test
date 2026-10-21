/* ============================================================
 * libraries.js — 라이브러리 (스포티파이 플레이리스트처럼 단어 묶음)
 *  - 단어는 하나만 저장하고, 라이브러리는 단어 ID 목록만 가짐
 *  - 한 단어가 여러 라이브러리에 들어갈 수 있음
 *  - 'all' = 모든 단어 (가상의 라이브러리)
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

/* ---------- 데이터 조작 ---------- */

function getLibrary(id) {
  return state.libraries.find(l => l.id === id) || null;
}

/** 라이브러리에 든 단어 목록 ('all'이면 전체) */
function libraryWords(libId) {
  if (libId === 'all') return state.words;
  const lib = getLibrary(libId);
  if (!lib) return [];
  const ids = new Set(lib.wordIds);
  return state.words.filter(w => ids.has(w.id));
}

function libraryName(libId) {
  if (libId === 'all') return '모든 단어';
  return getLibrary(libId)?.name || '(삭제된 라이브러리)';
}

/** 단어가 들어 있는 라이브러리 목록 */
function librariesOfWord(wordId) {
  return state.libraries.filter(l => l.wordIds.includes(wordId));
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
  if (state.settings.testLibrary === libId) { state.settings.testLibrary = 'all'; saveSettings(); }
  if (state.settings.addLibrary === libId) { state.settings.addLibrary = ''; saveSettings(); }
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
    </button>`,
    ...state.libraries.map(l => `
      <button class="lib-card" data-lib="${l.id}">
        ${coverHtml(l)}
        <span class="lib-card-name">${escapeHtml(l.name)}</span>
        <span class="lib-card-meta">${l.packId ? '단어팩 · ' : ''}단어 ${l.wordIds.length}개</span>
      </button>`)
  ];
  $('#lib-grid').innerHTML = cards.join('');

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
  if (libId !== 'all' && !getLibrary(libId)) libId = 'all';
  currentLibId = libId;
  $('#lib-home').hidden = true;
  $('#lib-detail').hidden = false;
  $('#list-search').value = '';
  renderLibraryHero();
  renderList();
  window.scrollTo(0, 0);
}

function renderLibraryHero() {
  const isAll = currentLibId === 'all';
  const lib = isAll ? null : getLibrary(currentLibId);
  const info = isAll ? ALL_COVER : lib;
  $('#lib-hero-cover').outerHTML = coverHtml(info, 'lib-cover-large').replace('<div class="lib-cover', '<div id="lib-hero-cover" class="lib-cover');
  $('#lib-hero-kind').textContent = isAll ? '전체 단어장' : (lib.packId ? '단어팩 라이브러리' : '라이브러리');
  $('#lib-hero-name').textContent = info.name;
  const count = libraryWords(currentLibId).length;
  $('#lib-hero-desc').textContent = (isAll ? '등록한 모든 단어' : (lib.desc || '')) + ` · 단어 ${count}개`;
  $('#lib-edit-btn').hidden = isAll;
  $('#lib-delete-btn').hidden = isAll;
  $('#lib-test-btn').disabled = count === 0;
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
    <p class="hint">이미 등록된 단어는 뜻을 바꾸지 않고 라이브러리에만 연결합니다.</p>`;

  const choice = await showDialog({
    title: pack.name,
    html,
    buttons: installed
      ? [{ label: '닫기', value: null }, { label: '라이브러리 열기', value: 'open', primary: true }]
      : [{ label: '닫기', value: null }, { label: '내 라이브러리에 추가', value: 'install', primary: true }]
  });
  if (choice === 'open') openLibrary(installed.id);
  if (choice === 'install') {
    const { lib, created, linked } = installPack(pack);
    showToast(`새 단어 ${created}개 추가${linked ? `, 기존 단어 ${linked}개 연결` : ''}`, 3000);
    openLibrary(lib.id);
  }
}

/** 단어를 어느 라이브러리에 넣을지 고르는 대화상자 (체크박스) */
async function manageWordLibraries(wordId) {
  const w = getWordById(wordId);
  if (!w) return;
  const rows = state.libraries.map(l => `
    <label class="check-row">
      <input type="checkbox" value="${l.id}" ${l.wordIds.includes(wordId) ? 'checked' : ''}>
      ${coverHtml(l, 'lib-cover-mini')}<span>${escapeHtml(l.name)}</span>
    </label>`).join('');
  const html = (rows || '<p class="hint">아직 라이브러리가 없습니다.</p>') +
    '<button type="button" class="btn btn-small" id="wl-new-btn">＋ 새 라이브러리</button>';

  const result = await showDialog({
    title: `"${w.word}" 라이브러리`,
    html,
    buttons: [{ label: '취소', value: null }, { label: '저장', value: 'save', primary: true }],
    onOpen: () => $('#wl-new-btn').addEventListener('click', () => { $('#modal').dataset.wantNew = '1'; $('#modal-actions .btn-primary').click(); }),
    beforeClose: v => {
      if (v !== 'save') return true;
      const checked = new Set($$('#modal-body .check-row input:checked').map(i => i.value));
      state.libraries.forEach(l => {
        const has = l.wordIds.includes(wordId);
        if (checked.has(l.id) && !has) l.wordIds.push(wordId);
        if (!checked.has(l.id) && has) l.wordIds = l.wordIds.filter(id => id !== wordId);
      });
      saveLibraries();
      return true;
    }
  });
  // "새 라이브러리" 버튼: 지금까지 선택을 저장한 뒤 새로 만들고 그 라이브러리에 넣기
  if ($('#modal').dataset.wantNew) {
    delete $('#modal').dataset.wantNew;
    const lib = await openLibraryDialog();
    if (lib) { addWordsToLibrary(lib.id, [wordId]); showToast(`"${lib.name}"에 넣었습니다.`); }
  } else if (result === 'save') {
    showToast('저장했습니다.');
  }
  renderLibraryHero();
  renderList();
}

/** 라이브러리 탭에 들어올 때 */
function onEnterLibraryView() {
  if ($('#lib-detail').hidden) renderLibraryHome();
  else if (currentLibId !== 'all' && !getLibrary(currentLibId)) showLibraryHome();
  else { renderLibraryHero(); renderList(); }
}

function initLibraryView() {
  $('#lib-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-lib]');
    if (card) openLibrary(card.dataset.lib);
  });
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
  $('#lib-test-btn').addEventListener('click', async () => {
    const inProgress = quiz && (quiz.phase === 'answer' || quiz.phase === 'feedback');
    if (inProgress && !(await confirmDialog('진행 중인 테스트', '풀던 테스트를 그만두고 이 라이브러리로 새로 시작할까요?\n(풀던 기록은 반영되지 않습니다)', '새로 시작'))) return;
    state.settings.testLibrary = currentLibId;
    saveSettings();
    quiz = null;
    showTestPanel('setup');
    switchTab('test');
  });
  $('#lib-add-words-btn').addEventListener('click', () => {
    state.settings.addLibrary = currentLibId === 'all' ? '' : currentLibId;
    saveSettings();
    switchTab('add');
  });
}
