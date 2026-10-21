/* ============================================================
 * list.js — 라이브러리 안의 단어 목록 (검색, 정렬, 수정, 삭제, 발음 듣기)
 *  - 삭제·빼기는 확인 없이 바로 하고 6초 동안 되돌리기
 *  - 왼쪽으로 밀면 삭제(모든 단어)/빼기(라이브러리) 버튼, ⋯ 메뉴, ＋ 담기
 * ============================================================ */

/** 정답률(%) 계산. 출제된 적이 없으면 null */
function accuracyOf(w) {
  if (!w.asked) return null;
  return Math.round(((w.asked - w.wrong) / w.asked) * 100);
}

/** 검색어에 맞는 단어만 고르기 */
function filterWords(words, query) {
  const q = query.trim().toLowerCase();
  if (!q) return words;
  return words.filter(w =>
    w.word.toLowerCase().includes(q) ||
    w.meanings.some(m => m.toLowerCase().includes(q)) ||
    (w.memo || '').toLowerCase().includes(q)
  );
}

/** 정렬 기준에 따라 정렬한 새 배열 반환 */
function sortWords(words, sortBy) {
  const a = words.slice();
  switch (sortBy) {
    case 'alpha':
      a.sort((x, y) => x.word.localeCompare(y.word, 'en', { sensitivity: 'base' }));
      break;
    case 'accuracy':
      // 정답률 낮은 순, 출제 안 된 단어는 맨 뒤
      a.sort((x, y) => {
        const ax = accuracyOf(x), ay = accuracyOf(y);
        if (ax === null && ay === null) return 0;
        if (ax === null) return 1;
        if (ay === null) return -1;
        return ax - ay || y.wrong - x.wrong;
      });
      break;
    case 'wrong':
      a.sort((x, y) => y.wrong - x.wrong || (accuracyOf(x) ?? 101) - (accuracyOf(y) ?? 101));
      break;
    default: // recent
      a.sort((x, y) => y.createdAt - x.createdAt);
  }
  return a;
}

/** 지금 보고 있는 목록에서 단어를 지울 때의 동작: 'delete'(모든 단어) | 'remove'(라이브러리에서 빼기) | null */
function listRemoveMode() {
  if (currentLibId === 'all') return 'delete';
  return getLibrary(currentLibId) ? 'remove' : null; // 자동 목록에서는 지우지 않음
}

/** 단어 하나를 목록 항목 HTML로 (🔊 · 내용 · ＋/✓ · ⋯, 왼쪽으로 밀면 삭제/빼기) */
function wordItemHtml(w) {
  const acc = accuracyOf(w);
  const accText = acc === null ? '-' : `${acc}%`;
  const accClass = acc !== null && acc < 60 ? 'low' : '';
  // '모든 단어'에서는 어느 라이브러리에 들어 있는지 표시
  const chips = currentLibId === 'all'
    ? librariesOfWord(w.id).map(l => `<span class="chip">${escapeHtml(l.name)}</span>`).join('')
    : '';
  const inDefault = isInDefaultLibrary(w.id);
  const mode = listRemoveMode();
  return `
    <li class="word-item" data-id="${w.id}">
      ${mode ? `<button class="swipe-action" data-action="swipe-remove" tabindex="-1">${mode === 'delete' ? '삭제' : '빼기'}</button>` : ''}
      <div class="word-row">
        <button class="btn-icon" data-action="speak" aria-label="${escapeHtml(w.word)} 발음 듣기">🔊</button>
        <div class="word-main">
          <div class="word-head">
            <span class="word-text">${escapeHtml(w.word)}</span>
            ${w.sample ? '<span class="badge">예시</span>' : ''}
          </div>
          <p class="word-meaning">${escapeHtml(w.meanings.join(', '))}</p>
          ${w.memo ? `<p class="word-memo">${escapeHtml(w.memo)}</p>` : ''}
          <div class="word-stats">출제 ${w.asked}회 · 오답 ${w.wrong}회 · 정답률 <span class="${accClass}">${accText}</span></div>
          ${chips ? `<div class="chips">${chips}</div>` : ''}
        </div>
        <div class="word-actions">
          <button class="icon-btn add-btn${inDefault ? ' on' : ''}" data-action="quick-add"
                  aria-label="${inDefault ? '담은 라이브러리 바꾸기' : `${escapeHtml(defaultLibraryName())}에 담기`}">${inDefault ? '✓' : '＋'}</button>
          <button class="icon-btn" data-action="menu" aria-label="더 보기">⋯</button>
        </div>
      </div>
    </li>`;
}

/** 현재 라이브러리의 단어 목록 다시 그리기 */
function renderList() {
  const query = $('#list-search').value;
  const sortBy = $('#list-sort').value;
  const all = libraryWords(currentLibId);
  const words = sortWords(filterWords(all, query), sortBy);

  $('#word-list').innerHTML = words.map(wordItemHtml).join('');
  $('#list-empty').hidden = all.length > 0;
  $('#list-empty').textContent = currentLibId === 'all'
    ? '등록된 단어가 없습니다. ‘단어 등록’ 탭이나 아래 단어팩에서 단어를 추가하세요.'
    : '이 라이브러리에 단어가 없습니다. ‘＋ 단어 추가’를 누르거나, 모든 단어에서 ‘라이브러리’ 버튼으로 넣으세요.';
  $('#list-count').textContent = all.length === 0 ? '' :
    (query.trim() ? `검색 결과 ${words.length}개 / 전체 ${all.length}개` : `전체 ${all.length}개`);
}

/** 수정 대화상자 */
async function openEditDialog(id) {
  const w = getWordById(id);
  if (!w) return;

  const html = `
    <label class="field"><span>영단어</span>
      <input type="text" id="edit-word" value="${escapeHtml(w.word)}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
    <label class="field"><span>뜻 <small>(쉼표로 구분)</small></span>
      <input type="text" id="edit-meaning" value="${escapeHtml(w.meanings.join(', '))}"></label>
    <label class="field"><span>메모 / 예문</span>
      <textarea id="edit-memo" rows="3">${escapeHtml(w.memo)}</textarea></label>
    <label class="field"><span>통계</span>
      <small>출제 ${w.asked}회 · 오답 ${w.wrong}회</small>
      <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-weight:400">
        <input type="checkbox" id="edit-reset-stats" style="width:24px;height:24px"> 이 단어의 통계 초기화
      </label>
    </label>`;

  let values = null;
  const result = await showDialog({
    title: '단어 수정',
    html,
    buttons: [
      { label: '취소', value: 'cancel' },
      { label: '저장', value: 'save', primary: true }
    ],
    onOpen: () => $('#edit-word').focus(),
    // 닫기 전에 입력 검증 (실패하면 대화상자 유지)
    beforeClose: (v) => {
      if (v !== 'save') return true;
      const word = $('#edit-word').value.trim();
      const meanings = splitMeanings($('#edit-meaning').value);
      if (!word) { showToast('영단어를 입력하세요.'); return false; }
      if (meanings.length === 0) { showToast('뜻을 입력하세요.'); return false; }
      values = { word, meanings, memo: $('#edit-memo').value, resetStats: $('#edit-reset-stats').checked };
      return true;
    }
  });
  if (result !== 'save' || !values) return;

  // 다른 단어와 철자가 겹치면 경고
  const other = findWord(values.word, w.id);
  if (other) {
    const ok = await confirmDialog(
      '이미 있는 단어',
      `"${other.word}"(${other.meanings.join(', ')})이(가) 이미 있습니다.\n기존 항목을 지우고 이 내용으로 덮어쓸까요?`,
      '덮어쓰기'
    );
    if (!ok) return;
    deleteWord(other.id);
  }

  overwriteWord(w, values);
  if (values.resetStats) { w.asked = 0; w.wrong = 0; w.lastTested = null; }
  saveWords();
  refreshListView();
  showToast('수정했습니다.');
}

/** 목록 전체 다시 그리기 (머리말 + 단어) */
function refreshListView() {
  closeSwipe();
  renderLibraryHero();
  renderList();
}

/** 삭제/빼기 — 확인 없이 바로 하고 되돌리기 토스트 */
function removeWordFromList(id) {
  const mode = listRemoveMode();
  if (mode === 'delete') deleteWordsWithUndo([id], refreshListView);
  else if (mode === 'remove') removeFromLibraryWithUndo(currentLibId, [id], refreshListView);
}

/** ⋯ 메뉴: 수정, 라이브러리에 담기, 빼기/삭제 */
async function openWordMenu(id) {
  const w = getWordById(id);
  if (!w) return;
  const mode = listRemoveMode();
  const items = [
    { label: '수정', value: 'edit' },
    { label: '라이브러리에 담기…', value: 'libs' }
  ];
  if (mode === 'remove') items.push({ label: `'${libraryName(currentLibId)}'에서 빼기`, value: 'remove', danger: true });
  if (mode === 'delete') items.push({ label: '삭제', value: 'remove', danger: true });
  const v = await showSheet(w.word, items);
  if (v === 'edit') openEditDialog(id);
  else if (v === 'libs') openLibrarySheet([id], refreshListView);
  else if (v === 'remove') removeWordFromList(id);
}

/* ---------- 왼쪽으로 밀어 삭제/빼기 ---------- */

const SWIPE_WIDTH = 96;
let swipe = null;          // 진행 중인 밀기 { li, row, startX, startY, dx, horizontal, base, pointerId }
let openSwipeLi = null;    // 열려 있는 항목
let suppressListClick = false;

function closeSwipe(li = openSwipeLi) {
  if (!li) return;
  const row = li.querySelector('.word-row');
  if (row) row.style.transform = '';
  li.classList.remove('swiped');
  if (li === openSwipeLi) openSwipeLi = null;
}

function initSwipe(list) {
  list.addEventListener('pointerdown', e => {
    const row = e.target.closest('.word-row');
    if (!row || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const li = row.parentElement;
    if (!li.querySelector('.swipe-action')) return;
    if (openSwipeLi && openSwipeLi !== li) closeSwipe();
    swipe = {
      li, row, startX: e.clientX, startY: e.clientY, dx: 0, horizontal: null,
      base: li.classList.contains('swiped') ? -SWIPE_WIDTH : 0, pointerId: e.pointerId
    };
  });
  list.addEventListener('pointermove', e => {
    if (!swipe || e.pointerId !== swipe.pointerId) return;
    const dx = e.clientX - swipe.startX;
    const dy = e.clientY - swipe.startY;
    if (swipe.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      swipe.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!swipe.horizontal) { swipe = null; return; } // 세로 스크롤은 브라우저에 맡김
      try { swipe.row.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      swipe.row.style.transition = 'none';
    }
    swipe.dx = dx;
    const x = Math.max(-SWIPE_WIDTH * 1.3, Math.min(0, swipe.base + dx));
    swipe.row.style.transform = `translateX(${x}px)`;
  });
  const end = () => {
    if (!swipe) return;
    const s = swipe;
    swipe = null;
    if (!s.horizontal) return;
    s.row.style.transition = '';
    if (s.base + s.dx < -SWIPE_WIDTH / 2) {
      s.row.style.transform = `translateX(${-SWIPE_WIDTH}px)`;
      s.li.classList.add('swiped');
      openSwipeLi = s.li;
    } else {
      closeSwipe(s.li);
    }
    // 밀기가 끝날 때 생기는 click은 무시
    suppressListClick = true;
    setTimeout(() => { suppressListClick = false; }, 60);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

function initListView() {
  $('#list-search').addEventListener('input', renderList);
  $('#list-sort').addEventListener('change', renderList);

  const list = $('#word-list');
  initSwipe(list);
  // 목록 버튼은 이벤트 위임으로 처리
  list.addEventListener('click', e => {
    if (suppressListClick) return;
    const btn = e.target.closest('button[data-action]');
    const li = e.target.closest('.word-item');
    // 밀어서 열린 항목이 있으면 먼저 닫기 (삭제 버튼 자체는 제외)
    if (openSwipeLi && !(btn && btn.dataset.action === 'swipe-remove')) {
      closeSwipe();
      return;
    }
    if (!btn || !li) return;
    const id = li.dataset.id;
    const action = btn.dataset.action;
    if (action === 'speak') speak(getWordById(id)?.word || '');
    else if (action === 'quick-add') quickAddToDefault(id, refreshListView);
    else if (action === 'menu') openWordMenu(id);
    else if (action === 'swipe-remove') removeWordFromList(id);
  });
}
