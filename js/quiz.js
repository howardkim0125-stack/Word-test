/* ============================================================
 * quiz.js — 테스트 (출제, 채점, 결과, 틀린 것만 다시 풀기)
 *  - 진행 중인 시험은 문제마다 wt.quizRun에 저장 → 앱을 다시 열면 "이어서 풀기"
 * ============================================================ */

// 진행 중인 테스트 상태
let quiz = null;
/*
 * quiz = {
 *   questions: [{ wordId, word, meanings, memo, dir, type, prompt, answerText, choices, correctIndex }],
 *   index: 현재 문제 번호,
 *   answers: [{ question, userAnswer, correct, near, note, accepted }]  (answers[i]는 questions[i]의 답),
 *   phase: 'answer' | 'feedback' | 'done',
 *   gradedAt / shownAt: 채점·출제 시각 (Enter 중복 입력 방지용),
 *   scope: 출제 범위 라이브러리 ID 목록, scopeName, settings: 시작할 때 설정, startedAt, retry: 다시 풀기 여부
 * }
 */

const DIRECTION_LABEL = { en2ko: '영어 → 한국어', ko2en: '한국어 → 영어' };

/* ---------- 출제 단어 고르기 ---------- */

/** 완전 무작위로 n개 고르기 */
function pickRandom(words, n) {
  return shuffle(words).slice(0, n);
}

/**
 * 오답률 기반 가중치
 *  - (오답 + 1) / (출제 + 2) : 한 번도 안 나온 단어는 0.5, 자주 틀린 단어일수록 1에 가까움
 *  - 잘 맞히는 단어도 가끔은 나오도록 최소값 0.05
 */
function wordWeight(w) {
  return Math.max(0.05, (w.wrong + 1) / (w.asked + 2));
}

/** 가중치 랜덤으로 중복 없이 n개 고르기 (Efraimidis–Spirakis 방식) */
function pickWeighted(words, n) {
  return words
    .map(w => ({ w, key: Math.pow(Math.random(), 1 / wordWeight(w)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map(x => x.w);
}

/* ---------- 문제 만들기 ---------- */

/** 두 단어의 뜻이 겹치는지 (객관식 보기에 정답이 두 개 생기는 것 방지) */
function meaningsOverlap(a, b) {
  const set = new Set(a.meanings.map(m => normalizeAnswer(m)));
  return b.meanings.some(m => set.has(normalizeAnswer(m)));
}

/**
 * 객관식 보기 만들기 — 오답 보기는 다른 단어의 뜻(한→영이면 다른 영단어)에서 무작위로
 * @returns {{choices: string[], correctIndex: number} | null} 보기를 2개 이상 못 만들면 null
 */
function buildChoices(word, dir) {
  const correctText = dir === 'en2ko' ? word.meanings.join(', ') : word.word;
  const used = new Set([normalizeAnswer(correctText)]);
  const distractors = [];

  for (const other of shuffle(state.words)) {
    if (distractors.length >= 3) break;
    if (other.id === word.id || meaningsOverlap(word, other)) continue;
    if (dir === 'ko2en' && wordKey(other.word) === wordKey(word.word)) continue;
    const text = dir === 'en2ko' ? other.meanings.join(', ') : other.word;
    const key = normalizeAnswer(text);
    if (used.has(key)) continue;
    used.add(key);
    distractors.push(text);
  }
  if (distractors.length === 0) return null;

  const choices = shuffle([correctText, ...distractors]);
  return { choices, correctIndex: choices.indexOf(correctText) };
}

/** 형식 결정: 추천 조합이면 영→한은 객관식, 한→영은 주관식 */
function questionFormat(format, dir) {
  if (format === 'auto') return dir === 'en2ko' ? 'choice' : 'input';
  return format;
}

/** 단어 하나로 문제 하나 만들기 */
function buildQuestion(word, settings) {
  const dir = settings.direction === 'mix' ? (Math.random() < 0.5 ? 'en2ko' : 'ko2en') : settings.direction;
  const q = {
    wordId: word.id,
    word: word.word,
    meanings: word.meanings.slice(),
    memo: word.memo,
    dir,
    type: 'input',
    prompt: dir === 'en2ko' ? word.word : word.meanings.join(', '),
    answerText: dir === 'en2ko' ? word.meanings.join(', ') : word.word,
    choices: null,
    correctIndex: -1
  };
  if (questionFormat(settings.format, dir) === 'choice') {
    const built = buildChoices(word, dir);
    if (built) { // 단어가 너무 적어 보기를 못 만들면 주관식으로 출제
      q.type = 'choice';
      q.choices = built.choices;
      q.correctIndex = built.correctIndex;
    }
  }
  return q;
}

/* ---------- 채점 ---------- */

/** 비교용 정규화: 앞뒤 공백 제거, 소문자, 연속 공백 하나로 */
function normalizeAnswer(text) {
  return String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// 영→한 채점에서 떼고 비교하는 끝말 (긴 것부터) — "포기하다" = "포기" = "포기함"
const KO_ENDINGS = ['적인', '하다', '되다', '함', '기', '한'];

/** 뜻 정리: 소문자, 괄호 내용, "~을/를/에…" 같은 표시, 띄어쓰기 제거 */
function cleanMeaning(text) {
  return normalizeAnswer(text)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/~\s*(을|를|이|가|은|는|에게|에서|에|와|과|의|으로|로)?/g, '')
    .replace(/[\s.·]/g, '');
}

/** 뜻 비교용 후보: 정리한 말 + 끝말을 뗀 말 */
function meaningVariants(text) {
  const base = cleanMeaning(text);
  const out = [base];
  for (const end of KO_ENDINGS) {
    if (base.length > end.length && base.endsWith(end)) { out.push(base.slice(0, -end.length)); break; }
  }
  return out.filter(Boolean);
}

/**
 * 주관식 채점 → { correct, near, note }
 *  - 영→한: 쉼표로 여러 개 적었으면 하나라도 맞으면 정답
 *           띄어쓰기·괄호·"~을/를"·끝말(하다/되다/함/기/적인/한) 차이는 무시
 *           한 글자만 다르면 "거의 정답" (오답이지만 정답 인정 버튼 강조)
 *  - 한→영: 영단어와 같으면 정답 (대소문자·앞뒤 공백 무시)
 *           철자 1글자 차이는 "1글자 틀림", 내 단어장의 다른 단어면 "다른 단어예요"
 */
function gradeInput(q, userAnswer) {
  const answer = normalizeAnswer(userAnswer);
  if (!answer) return { correct: false };

  if (q.dir === 'ko2en') {
    const target = normalizeAnswer(q.word);
    if (answer === target) return { correct: true };
    const other = findWord(answer);
    if (other && other.id !== q.wordId) {
      const same = meaningsOverlap(other, { meanings: q.meanings });
      return { correct: false, note: `${same ? '뜻이 같은 ' : ''}다른 단어예요 (뜻: ${other.meanings.join(', ')})` };
    }
    if (editDistance(answer, target) === 1) return { correct: false, near: true, note: '1글자 틀림' };
    return { correct: false };
  }

  const correctList = [...new Set(q.meanings.flatMap(meaningVariants))];
  const correctSet = new Set(correctList);
  const userVariants = splitMeanings(answer).flatMap(meaningVariants);
  if (userVariants.some(v => correctSet.has(v))) return { correct: true };
  const near = userVariants.some(v => correctList.some(c => c.length >= 2 && editDistance(v, c) === 1));
  return near ? { correct: false, near: true, note: '한 글자만 달라요' } : { correct: false };
}

/* ---------- 진행 중인 시험 저장 (이어서 풀기) ---------- */

/** 지금 시험을 wt.quizRun에 저장 (answers[i]는 questions[i]의 답이라 question은 빼고 저장) */
function saveQuizRun() {
  if (!quiz || quiz.phase === 'done') return;
  writeJSON(STORAGE_KEYS.quizRun, {
    questions: quiz.questions,
    index: quiz.index,
    answers: quiz.answers.map(({ question, ...rest }) => rest),
    scope: quiz.scope,
    scopeName: quiz.scopeName,
    settings: quiz.settings,
    startedAt: quiz.startedAt,
    retry: !!quiz.retry
  });
}

function clearQuizRun() {
  try { localStorage.removeItem(STORAGE_KEYS.quizRun); } catch (e) { /* 무시 */ }
}

/** 저장된 시험 불러오기 (형식이 이상하면 null) */
function loadQuizRun() {
  const r = readJSON(STORAGE_KEYS.quizRun, null);
  if (!r || !Array.isArray(r.questions) || !r.questions.length || !Array.isArray(r.answers)) return null;
  if (r.answers.length > r.questions.length) return null;
  return r;
}

/** 저장된 시험 이어서 풀기 */
function resumeQuiz() {
  const r = loadQuizRun();
  if (!r) { renderTestSetup(); return; }
  quiz = {
    questions: r.questions,
    answers: r.answers.map((a, i) => ({ ...a, question: r.questions[i] })),
    index: r.answers.length, // 채점까지 끝난 문제 다음부터
    phase: 'answer',
    gradedAt: 0,
    scope: r.scope || ['all'],
    scopeName: r.scopeName || '',
    settings: r.settings || { ...state.settings },
    startedAt: r.startedAt || Date.now(),
    retry: !!r.retry
  };
  if (quiz.index >= quiz.questions.length) { finishTest(); return; }
  showTestPanel('run');
  renderQuestion();
}

/* ---------- 테스트 진행 ---------- */

/** 출제 범위의 단어 (여러 라이브러리면 합치고 중복은 한 번만) */
function scopeWords(scope) {
  const seen = new Set();
  const out = [];
  scope.forEach(id => libraryWords(id).forEach(w => { if (!seen.has(w.id)) { seen.add(w.id); out.push(w); } }));
  return out;
}

function scopeLabel(scope) {
  return scope.map(libraryName).join(' + ');
}

/** 지금 설정의 출제 범위 */
function currentScope() {
  const id = state.settings.testLibrary;
  return [id === 'all' || getLibrary(id) ? id : 'all'];
}

/**
 * 테스트 시작
 * @param {Array} targetWords 주면 그 단어들만 출제 (틀린 것만 다시 풀기 등)
 * @param {object} opts { scope, scopeName, settings }
 */
function startTest(targetWords = null, opts = {}) {
  const s = { ...state.settings, ...(opts.settings || {}) };
  const scope = opts.scope || currentScope();
  const pool = targetWords || scopeWords(scope);
  if (pool.length === 0) {
    showToast('출제할 단어가 없습니다. 먼저 단어를 등록하세요.');
    return;
  }
  let picked;
  if (targetWords) {
    picked = shuffle(targetWords);
  } else {
    const n = s.count > 0 ? Math.min(s.count, pool.length) : pool.length;
    picked = s.mode === 'weighted' ? pickWeighted(pool, n) : pickRandom(pool, n);
  }

  quiz = {
    questions: picked.map(w => buildQuestion(w, s)),
    index: 0,
    answers: [],
    phase: 'answer',
    gradedAt: 0,
    scope,
    scopeName: opts.scopeName || scopeLabel(scope),
    settings: { direction: s.direction, format: s.format, mode: s.mode, count: s.count },
    startedAt: Date.now(),
    retry: !!targetWords
  };
  saveQuizRun();
  showTestPanel('run');
  renderQuestion();
}

/** 테스트 화면의 세 패널(설정/풀이/결과) 중 하나만 보이기 */
function showTestPanel(name) {
  $('#test-setup').hidden = name !== 'setup';
  $('#test-run').hidden = name !== 'run';
  $('#test-result').hidden = name !== 'result';
  if (name === 'setup') renderTestSetup();
}

function currentQuestion() {
  return quiz ? quiz.questions[quiz.index] : null;
}

/** 현재 문제 그리기 */
function renderQuestion() {
  const q = currentQuestion();
  const total = quiz.questions.length;
  quiz.phase = 'answer';
  quiz.shownAt = Date.now();

  $('#quiz-progress').textContent = `${quiz.index + 1} / ${total}`;
  $('#quiz-progress-bar').style.width = `${(quiz.index / total) * 100}%`;
  $('#quiz-direction').textContent = DIRECTION_LABEL[q.dir] + (q.type === 'choice' ? ' · 객관식' : ' · 주관식');
  $('#quiz-prompt').textContent = q.prompt;
  // 영→한일 때만 처음부터 발음 버튼 표시 (한→영은 정답이 들리므로 채점 후에 표시)
  $('#quiz-speak-btn').hidden = q.dir !== 'en2ko';
  $('#quiz-feedback').hidden = true;

  const form = $('#quiz-input-form');
  const input = $('#quiz-answer');
  const choicesEl = $('#quiz-choices');

  if (q.type === 'input') {
    form.hidden = false;
    choicesEl.hidden = true;
    input.value = '';
    input.readOnly = false;
    input.className = 'quiz-answer';
    input.placeholder = q.dir === 'en2ko' ? '뜻 입력 후 Enter' : '영단어 입력 후 Enter';
    $('#quiz-submit-btn').hidden = false;
    input.focus();
  } else {
    form.hidden = true;
    choicesEl.hidden = false;
    choicesEl.innerHTML = q.choices.map((c, i) =>
      `<button class="choice" data-index="${i}"><span class="num">${i + 1}</span>${escapeHtml(c)}</button>`
    ).join('');
    // 이전 문제에서 입력칸에 포커스가 남아 있으면 숫자키가 입력칸으로 가므로 해제
    if (document.activeElement === input) input.blur();
  }
}

/** 주관식 제출 (Enter 또는 제출 버튼) */
function handleInputSubmit(e) {
  e.preventDefault();
  if (!quiz) return;
  if (quiz.phase === 'feedback') {
    // 한글 입력기에서 Enter가 두 번 들어오는 경우가 있어 채점 직후 짧은 시간은 무시
    if (Date.now() - quiz.gradedAt < 400) return;
    nextQuestion();
    return;
  }
  // 다음 문제로 넘어간 직후 Enter가 한 번 더 들어와 빈 답이 제출되는 것 방지
  if (Date.now() - quiz.shownAt < 400) return;
  const q = currentQuestion();
  const userAnswer = $('#quiz-answer').value.trim();
  // 빈 칸으로 제출하면 "모름"으로 보고 오답 처리
  recordAnswer(q, userAnswer, gradeInput(q, userAnswer));
}

/** 객관식 보기 선택 */
function handleChoice(index) {
  if (!quiz || quiz.phase !== 'answer') return;
  const q = currentQuestion();
  if (q.type !== 'choice' || index < 0 || index >= q.choices.length) return;
  recordAnswer(q, q.choices[index], { correct: index === q.correctIndex }, index);
}

/** 답 기록 후 채점 결과 보여주기 */
function recordAnswer(q, userAnswer, result, choiceIndex = -1) {
  quiz.answers.push({ question: q, userAnswer, correct: !!result.correct, near: !!result.near, note: result.note || '', accepted: false, choiceIndex });
  quiz.phase = 'feedback';
  quiz.gradedAt = Date.now();
  saveQuizRun();
  showFeedback(q, quiz.answers[quiz.answers.length - 1]);
}

/** 채점 직후 정답 표시 (거의 정답이면 "정답 인정" 버튼 강조) */
function showFeedback(q, ans) {
  const title = $('#quiz-feedback-title');
  title.textContent = ans.correct ? (ans.accepted ? '⭕ 정답 인정' : '⭕ 정답!') : (ans.near ? '🟡 거의 정답' : '❌ 오답');
  title.className = 'feedback-title ' + (ans.correct ? 'ok' : ans.near ? 'near' : 'bad');
  $('#quiz-feedback-note').textContent = ans.correct ? '' : ans.note;
  $('#quiz-feedback-note').hidden = ans.correct || !ans.note;
  $('#quiz-feedback-answer').textContent = q.dir === 'en2ko'
    ? `정답: ${q.meanings.join(', ')}`
    : `정답: ${q.word}  (${q.meanings.join(', ')})`;
  $('#quiz-feedback-memo').textContent = q.memo || '';
  $('#quiz-feedback-memo').hidden = !q.memo;
  // 주관식 오답일 때만 "정답 인정" 버튼 표시, 거의 정답이면 강조
  const accept = $('#quiz-accept-btn');
  accept.hidden = ans.correct || q.type !== 'input';
  accept.classList.toggle('btn-primary', !!ans.near && !ans.correct);
  $('#quiz-next-btn').classList.toggle('btn-primary', !(ans.near && !ans.correct));
  $('#quiz-next-btn').textContent = quiz.index + 1 >= quiz.questions.length ? '결과 보기 (Enter)' : '다음 (Enter)';
  $('#quiz-speak-btn').hidden = false;
  $('#quiz-feedback').hidden = false;

  if (q.type === 'input') {
    const input = $('#quiz-answer');
    input.readOnly = true; // 포커스는 유지해서 키보드 Enter로 바로 다음 문제로
    input.className = 'quiz-answer ' + (ans.correct ? 'correct' : 'wrong');
    $('#quiz-submit-btn').hidden = true;
  } else {
    $$('#quiz-choices .choice').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correctIndex) btn.classList.add('correct');
      else if (i === ans.choiceIndex) btn.classList.add('wrong');
    });
  }
}

/** "정답 인정" — 오답을 정답으로 수동 정정 */
function acceptAnswer() {
  const last = quiz && quiz.answers[quiz.answers.length - 1];
  if (!last || last.correct) return;
  last.correct = true;
  last.accepted = true;
  saveQuizRun();
  showFeedback(last.question, last);
  // 키보드 Enter로 계속 진행할 수 있게 입력칸에 포커스 복귀
  $('#quiz-answer').focus();
}

function nextQuestion() {
  if (!quiz || quiz.phase !== 'feedback') return;
  if (quiz.index + 1 >= quiz.questions.length) {
    finishTest();
    return;
  }
  quiz.index++;
  saveQuizRun();
  renderQuestion();
}

/** 그만하기 */
async function quitTest() {
  if (!quiz) return;
  const answered = quiz.answers.length;
  const choice = await showDialog({
    title: '테스트 그만하기',
    message: answered
      ? `지금까지 ${answered}문제를 풀었습니다.\n푼 문제까지 결과를 보고 통계에 반영할까요?`
      : '테스트를 그만할까요?',
    buttons: answered
      ? [
          { label: '계속 풀기', value: 'continue' },
          { label: '기록 없이 종료', value: 'discard', danger: true },
          { label: '결과 보기', value: 'finish', primary: true }
        ]
      : [
          { label: '계속 풀기', value: 'continue' },
          { label: '종료', value: 'discard', primary: true }
        ]
  });
  if (choice === 'finish') finishTest();
  else if (choice === 'discard') { quiz = null; clearQuizRun(); showTestPanel('setup'); }
  else if (quiz.phase === 'answer' && currentQuestion().type === 'input') $('#quiz-answer').focus();
}

/** 결과를 단어별 통계에 반영 */
function commitResults(answers) {
  const now = Date.now();
  answers.forEach(a => {
    const w = getWordById(a.question.wordId);
    if (!w) return; // 테스트 중 삭제된 단어
    w.asked++;
    if (!a.correct) w.wrong++;
    w.lastTested = now;
  });
  saveWords();
}

/** 테스트 종료 → 통계 반영 + 결과 화면 */
function finishTest() {
  const answers = quiz.answers;
  commitResults(answers);
  clearQuizRun();
  $('#quiz-answer').blur();

  const total = answers.length;
  const correct = answers.filter(a => a.correct).length;
  const wrong = answers.filter(a => !a.correct);
  const pct = total ? Math.round((correct / total) * 100) : 0;
  $('#result-score').textContent = `${correct} / ${total}  (${pct}점)`;

  $('#result-wrong-body').innerHTML = wrong.map(a => `
    <tr>
      <td>${escapeHtml(a.question.prompt)}</td>
      <td class="mine">${escapeHtml(a.userAnswer || '(무응답)')}</td>
      <td class="answer">${escapeHtml(a.question.answerText)}</td>
    </tr>`).join('');
  $('#result-wrong-wrap').hidden = wrong.length === 0;
  $('#result-perfect').hidden = wrong.length > 0 || total === 0;
  $('#retry-wrong-btn').hidden = wrong.length === 0;

  // "틀린 것만 다시 풀기"용으로 틀린 단어 ID 보관
  quiz.lastWrongIds = [...new Set(wrong.map(a => a.question.wordId))];
  quiz.phase = 'done';
  showTestPanel('result');
}

function retryWrong() {
  if (!quiz || !quiz.lastWrongIds) return;
  const words = quiz.lastWrongIds.map(getWordById).filter(Boolean);
  if (words.length === 0) { showToast('다시 풀 단어가 없습니다.'); return; }
  startTest(words, { scope: quiz.scope, scopeName: `${quiz.scopeName} · 틀린 것만`, settings: quiz.settings });
}

/* ---------- 테스트 설정 화면 ---------- */

/** 세그먼트 버튼에 현재 설정 표시 + 출제 개수 안내 + 이어서 풀기 */
function renderTestSetup() {
  $$('#test-setup .segmented').forEach(seg => {
    const key = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === String(state.settings[key])));
  });
  // 삭제된 라이브러리가 선택돼 있으면 '모든 단어'로
  if (state.settings.testLibrary !== 'all' && !getLibrary(state.settings.testLibrary)) {
    state.settings.testLibrary = 'all';
    saveSettings();
  }
  fillLibrarySelect($('#test-library'), { selected: state.settings.testLibrary, includeAll: true });

  const total = scopeWords(currentScope()).length;
  const count = state.settings.count;
  const n = count > 0 ? Math.min(count, total) : total;
  let info = total === 0
    ? '출제할 단어가 없습니다. 단어를 등록하거나 다른 범위를 고르세요.'
    : `${libraryName(state.settings.testLibrary)} ${total}개 중 ${n}문제 출제`;
  if (count > 0 && total > 0 && total < count) info += ' (단어가 적어 전부 출제)';
  if (state.settings.format === 'auto') info += '\n추천 조합: 영→한은 객관식, 한→영은 주관식으로 나옵니다.';
  if (state.settings.format !== 'input' && total > 0 && state.words.length < 4) info += '\n※ 단어가 4개 미만이면 객관식 보기 수가 줄어듭니다.';
  $('#test-count-info').textContent = info;
  $('#start-test-btn').disabled = total === 0;

  // 이어서 풀기
  const run = !quiz || quiz.phase === 'done' ? loadQuizRun() : null;
  $('#resume-box').hidden = !run;
  if (run) {
    const done = run.answers.length;
    $('#resume-btn').textContent = `이어서 풀기 (${done}/${run.questions.length})`;
    $('#resume-info').textContent = `${run.scopeName || '시험'} · ${formatDate(run.startedAt)}`;
  }
}

/** 새 시험 시작 버튼: 저장된 시험이 있으면 버릴지 확인 */
async function handleStartClick() {
  const run = loadQuizRun();
  if (run) {
    const ok = await confirmDialog('풀던 시험이 있어요', `풀던 시험(${run.answers.length}/${run.questions.length})을 버리고 새로 시작할까요?`, '새로 시작');
    if (!ok) return;
    clearQuizRun();
  }
  startTest();
}

/** 테스트 탭에 들어올 때: 진행 중이 아니면 설정 화면 갱신 */
function onEnterTestView() {
  const inProgress = quiz && (quiz.phase === 'answer' || quiz.phase === 'feedback');
  if (inProgress) {
    if (quiz.phase === 'answer' && currentQuestion().type === 'input') $('#quiz-answer').focus();
  } else if ($('#test-result').hidden) {
    showTestPanel('setup');
  }
}

function initTestView() {
  // 출제 방향/형식/모드/개수 선택 → 설정에 저장 (마지막 선택 기억)
  $$('#test-setup .segmented').forEach(seg => {
    seg.addEventListener('click', e => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      const key = seg.dataset.setting;
      state.settings[key] = key === 'count' ? Number(btn.dataset.value) : btn.dataset.value;
      saveSettings();
      renderTestSetup();
    });
  });

  $('#test-library').addEventListener('change', e => {
    state.settings.testLibrary = e.target.value;
    saveSettings();
    renderTestSetup();
  });
  $('#start-test-btn').addEventListener('click', handleStartClick);
  $('#resume-btn').addEventListener('click', resumeQuiz);
  $('#resume-discard-btn').addEventListener('click', async () => {
    if (!(await confirmDialog('풀던 시험 버리기', '풀던 시험을 버릴까요? (기록은 반영되지 않습니다)', '버리기', true))) return;
    clearQuizRun();
    renderTestSetup();
  });
  $('#quiz-input-form').addEventListener('submit', handleInputSubmit);
  $('#quiz-choices').addEventListener('click', e => {
    const btn = e.target.closest('.choice');
    if (btn) handleChoice(Number(btn.dataset.index));
  });
  $('#quiz-accept-btn').addEventListener('click', acceptAnswer);
  $('#quiz-next-btn').addEventListener('click', nextQuestion);
  $('#quiz-speak-btn').addEventListener('click', () => { const q = currentQuestion(); if (q) speak(q.word); });
  $('#quit-test-btn').addEventListener('click', quitTest);
  $('#retry-wrong-btn').addEventListener('click', retryWrong);
  $('#new-test-btn').addEventListener('click', () => { quiz = null; showTestPanel('setup'); });

  // 객관식: 숫자키 1~4로 선택, Enter로 다음 문제 (외장 키보드용)
  document.addEventListener('keydown', e => {
    if (!quiz || $('#view-test').hidden || $('#test-run').hidden || !$('#modal').hidden) return;
    const q = currentQuestion();
    if (!q || q.type !== 'choice') return;
    if (quiz.phase === 'answer' && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      handleChoice(Number(e.key) - 1);
    } else if (quiz.phase === 'feedback' && e.key === 'Enter') {
      e.preventDefault();
      if (Date.now() - quiz.gradedAt > 300) nextQuestion();
    }
  });
}
