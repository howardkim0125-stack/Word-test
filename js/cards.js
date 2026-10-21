/* ============================================================
 * cards.js — 카드 한 장씩 보기
 *  - 암기 카드: 라이브러리 상세 "▶ 암기" → 앞면(영단어+발음) → 탭하면 뒷면(뜻·메모)
 *    "알아요 / 몰라요"로 나누고 끝나면 "몰라요만 시험 보기"
 *  - 단어팩 골라 담기: "알아요"(건너뜀) / "모르겠어요"(담기) → 모르는 단어로 새 라이브러리
 * ============================================================ */

let cardSession = null;
/*
 * cardSession = { items: [{ word, meanings, memo, wordId }], index, flipped,
 *                 known: [], unknown: [], onFinish(result, completed) }
 */

/**
 * 카드 보기 시작
 * @param {object} opts { title, items, knowLabel, dontLabel, onFinish }
 */
function openCardSession({ title, items, knowLabel = '알아요', dontLabel = '몰라요', onFinish }) {
  if (!items.length) { showToast('볼 단어가 없습니다.'); return; }
  cardSession = { items, index: 0, flipped: false, known: [], unknown: [], onFinish };
  $('#cards-title').textContent = title;
  $('#cards-know').textContent = knowLabel;
  $('#cards-dont').textContent = dontLabel;
  $('#cards').hidden = false;
  document.body.classList.add('cards-open');
  renderCard();
}

function renderCard() {
  const s = cardSession;
  const it = s.items[s.index];
  $('#cards-progress').textContent = `${s.index + 1} / ${s.items.length}`;
  $('#cards-bar').style.width = `${(s.index / s.items.length) * 100}%`;
  $('#fc-word').textContent = it.word;
  $('#fc-meaning').textContent = it.meanings.join(', ');
  $('#fc-memo').textContent = it.memo || '';
  $('#fc-memo').hidden = !it.memo;
  s.flipped = false;
  $('#flashcard').classList.remove('flipped');
  $('#fc-back').hidden = true;
  $('#fc-hint').hidden = false;
  $('#cards-tally').textContent = `알아요 ${s.known.length} · ${$('#cards-dont').textContent} ${s.unknown.length}`;
}

/** 카드 뒤집기 (뜻 보기 ↔ 단어만) */
function flipCard() {
  if (!cardSession) return;
  cardSession.flipped = !cardSession.flipped;
  $('#flashcard').classList.toggle('flipped', cardSession.flipped);
  $('#fc-back').hidden = !cardSession.flipped;
  $('#fc-hint').hidden = cardSession.flipped;
}

/** 알아요(true) / 몰라요(false) 고르고 다음 카드 */
function answerCard(know) {
  const s = cardSession;
  if (!s) return;
  (know ? s.known : s.unknown).push(s.items[s.index]);
  if (s.index + 1 >= s.items.length) { closeCardSession(true); return; }
  s.index++;
  renderCard();
}

/** 끝내기 (completed=false면 중간에 그만둠) */
function closeCardSession(completed = false) {
  const s = cardSession;
  if (!s) return;
  cardSession = null;
  $('#cards').hidden = true;
  document.body.classList.remove('cards-open');
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (s.onFinish) s.onFinish({ known: s.known, unknown: s.unknown, seen: s.known.length + s.unknown.length, total: s.items.length }, completed);
}

/* ---------- 암기 카드 (라이브러리) ---------- */

function startFlashcards(libId) {
  const words = shuffle(libraryWords(libId));
  const name = libraryName(libId);
  openCardSession({
    title: `암기 · ${name}`,
    items: words.map(w => ({ word: w.word, meanings: w.meanings, memo: w.memo, wordId: w.id })),
    knowLabel: '알아요',
    dontLabel: '몰라요',
    onFinish: async (r) => {
      if (!r.seen) return;
      const dontWords = r.unknown.map(it => getWordById(it.wordId)).filter(Boolean);
      const v = await showDialog({
        title: '암기 결과',
        message: `${r.seen}장 중 알아요 ${r.known.length} · 몰라요 ${r.unknown.length}` +
          (r.unknown.length ? `\n\n몰라요: ${r.unknown.slice(0, 20).map(it => it.word).join(', ')}${r.unknown.length > 20 ? ' …' : ''}` : '\n\n모두 알고 있어요! 🎉'),
        buttons: dontWords.length
          ? [{ label: '닫기', value: null }, { label: `몰라요 ${dontWords.length}개만 시험 보기`, value: 'test', primary: true }]
          : [{ label: '닫기', value: null, primary: true }]
      });
      if (v === 'test' && (await confirmDiscardRun())) {
        switchTab('test');
        startTest(dontWords, { scope: [libId], scopeName: `${name} · 암기에서 몰라요`, settings: settingsForScope([libId]) });
      }
    }
  });
}

/* ---------- 단어팩 골라 담기 ---------- */

function startPackPicking(pack) {
  const items = shuffle(packWordList(pack)).map(it => {
    const mine = findWord(it.word);
    return { word: it.word, meanings: mine ? mine.meanings : it.meanings, memo: mine ? mine.memo : '', wordId: mine ? mine.id : null };
  });
  openCardSession({
    title: `골라 담기 · ${pack.name}`,
    items,
    knowLabel: '알아요',
    dontLabel: '모르겠어요',
    onFinish: async (r) => {
      if (!r.unknown.length) {
        if (r.seen) showToast(`${r.seen}장 모두 알아요 — 담을 단어가 없어요.`);
        return;
      }
      const ok = await confirmDialog(
        '새 라이브러리 만들기',
        `모르는 단어 ${r.unknown.length}개를 새 라이브러리로 만들까요?\n(${r.seen}/${r.total}장 확인)`,
        '만들기'
      );
      if (!ok) return;
      const lib = createLibrary({ name: `${pack.name} · 모르는 단어`, desc: `${pack.name}에서 골라 담은 단어`, color: pack.color });
      const ids = r.unknown.map(it => {
        const existing = findWord(it.word);
        if (existing) return existing.id;
        const rec = createWordRecord({ word: it.word, meanings: it.meanings.slice() });
        state.words.push(rec);
        return rec.id;
      });
      saveWords();
      addWordsToLibrary(lib.id, ids);
      touchLibrary(lib.id);
      showToast(`"${lib.name}"에 ${ids.length}개 담음`);
      switchTab('list');
      openLibrary(lib.id);
    }
  });
}

function initCards() {
  $('#flashcard').addEventListener('click', e => {
    if (e.target.closest('#fc-speak')) return;
    flipCard();
  });
  $('#fc-speak').addEventListener('click', () => { if (cardSession) speak(cardSession.items[cardSession.index].word); });
  $('#cards-know').addEventListener('click', () => answerCard(true));
  $('#cards-dont').addEventListener('click', () => answerCard(false));
  $('#cards-close').addEventListener('click', () => closeCardSession(false));
  // 외장 키보드: 스페이스 뒤집기, 1 알아요, 2 몰라요, Esc 끝내기
  document.addEventListener('keydown', e => {
    if (!cardSession || !$('#modal').hidden) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
    else if (e.key === '1') answerCard(true);
    else if (e.key === '2') answerCard(false);
    else if (e.key === 'Escape') closeCardSession(false);
  });
}
