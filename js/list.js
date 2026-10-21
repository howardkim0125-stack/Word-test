/* ============================================================
 * list.js — 라이브러리 안의 단어 목록 (검색, 정렬, 수정, 삭제, 발음 듣기)
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

/** 단어 하나를 목록 항목 HTML로 */
function wordItemHtml(w) {
  const acc = accuracyOf(w);
  const accText = acc === null ? '-' : `${acc}%`;
  const accClass = acc !== null && acc < 60 ? 'low' : '';
  // '모든 단어'에서는 어느 라이브러리에 들어 있는지 표시
  const chips = currentLibId === 'all'
    ? librariesOfWord(w.id).map(l => `<span class="chip">${escapeHtml(l.name)}</span>`).join('')
    : '';
  return `
    <li class="word-item" data-id="${w.id}">
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
        <button class="btn btn-small" data-action="edit">수정</button>
        <button class="btn btn-small" data-action="libs">라이브러리</button>
        <button class="btn btn-small btn-danger" data-action="delete">${currentLibId === 'all' ? '삭제' : '빼기'}</button>
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
  renderLibraryHero();
  renderList();
  showToast('수정했습니다.');
}

/** 삭제: '모든 단어'에서는 완전히 삭제, 라이브러리 안에서는 빼기/완전히 삭제 선택 */
async function confirmDelete(id) {
  const w = getWordById(id);
  if (!w) return;
  let choice;
  if (currentLibId === 'all') {
    const libs = librariesOfWord(id);
    const ok = await confirmDialog('단어 삭제',
      `"${w.word}"을(를) 삭제할까요?` + (libs.length ? `\n들어 있는 라이브러리 ${libs.length}개에서도 빠집니다.` : ''), '삭제', true);
    choice = ok ? 'delete' : null;
  } else {
    choice = await showDialog({
      title: `"${w.word}"`,
      message: `'${libraryName(currentLibId)}'에서 뺄까요?\n빼기만 하면 '모든 단어'에는 남아 있습니다.`,
      buttons: [
        { label: '취소', value: null },
        { label: '완전히 삭제', value: 'delete', danger: true },
        { label: '라이브러리에서 빼기', value: 'remove', primary: true }
      ]
    });
  }
  if (!choice) return;
  if (choice === 'remove') {
    removeWordFromLibrary(currentLibId, id);
    showToast('라이브러리에서 뺐습니다.');
  } else {
    deleteWord(id);
    showToast('삭제했습니다.');
  }
  renderLibraryHero();
  renderList();
}

function initListView() {
  $('#list-search').addEventListener('input', renderList);
  $('#list-sort').addEventListener('change', renderList);

  // 목록 버튼은 이벤트 위임으로 처리
  $('#word-list').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('.word-item').dataset.id;
    const action = btn.dataset.action;
    if (action === 'speak') speak(getWordById(id)?.word || '');
    else if (action === 'edit') openEditDialog(id);
    else if (action === 'libs') manageWordLibraries(id);
    else if (action === 'delete') confirmDelete(id);
  });
}
