/* ============================================================
 * quiz.js — 테스트 (출제, 채점, 결과, 틀린 것만 다시 풀기)
 * ============================================================ */

// 진행 중인 테스트 상태
let quiz = null;
/*
 * quiz = {
 *   questions: [{ wordId, word, meanings, memo, dir, type, prompt, answerText, choices, correctIndex }],
 *   index: 현재 문제 번호,
 *   answers: [{ question, userAnswer, correct, accepted }],
 *   phase: 'answer' | 'feedback',
 *   gradedAt / shownAt: 채점·출제 시각 (Enter 중복 입력 방지용)
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
  if (settings.format === 'choice') {
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

/** 뜻 비교용 후보: 원문, 괄호 내용 뺀 것, 띄어쓰기 뺀 것 */
function meaningVariants(text) {
  const base = normalizeAnswer(text);
  const noParen = normalizeAnswer(base.replace(/\([^)]*\)|\[[^\]]*\]/g, ''));
  return [base, noParen, base.replace(/\s/g, ''), noParen.replace(/\s/g, '')].filter(Boolean);
}

/**
 * 주관식 채점
 *  - 영→한: 쉼표로 여러 개 적었으면 하나라도 뜻과 맞으면 정답 (띄어쓰기·괄호 차이는 무시)
 *  - 한→영: 영단어와 같으면 정답 (대소문자·앞뒤 공백 무시)
 */
function gradeInput(q, userAnswer) {
  const answer = normalizeAnswer(userAnswer);
  if (!answer) return false;
  if (q.dir === 'ko2en') return answer === normalizeAnswer(q.word);

  const correctSet = new Set(q.meanings.flatMap(meaningVariants));
  const parts = splitMeanings(answer);
  return parts.some(p => meaningVariants(p).some(v => correctSet.has(v)));
}

/* ---------- 테스트 진행 ---------- */

/** 테스트 시작. targetWords를 주면 그 단어들만 출제 (틀린 것만 다시 풀기) */
function startTest(targetWords = null) {
  if (state.words.length === 0) {
    showToast('저장된 단어가 없습니다. 먼저 단어를 등록하세요.');
    return;
  }
  const s = state.settings;
  let picked;
  if (targetWords) {
    picked = shuffle(targetWords);
  } else {
    const n = Math.min(s.count, state.words.length);
    picked = s.mode === 'weighted' ? pickWeighted(state.words, n) : pickRandom(state.words, n);
  }

  quiz = {
    questions: picked.map(w => buildQuestion(w, s)),
    index: 0,
    answers: [],
    phase: 'answer',
    gradedAt: 0
  };
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
  recordAnswer(q, userAnswer, userAnswer ? gradeInput(q, userAnswer) : false);
}

/** 객관식 보기 선택 */
function handleChoice(index) {
  if (!quiz || quiz.phase !== 'answer') return;
  const q = currentQuestion();
  if (q.type !== 'choice' || index < 0 || index >= q.choices.length) return;
  recordAnswer(q, q.choices[index], index === q.correctIndex, index);
}

/** 답 기록 후 채점 결과 보여주기 */
function recordAnswer(q, userAnswer, correct, choiceIndex = -1) {
  quiz.answers.push({ question: q, userAnswer, correct, accepted: false });
  quiz.phase = 'feedback';
  quiz.gradedAt = Date.now();
  showFeedback(q, correct, choiceIndex);
}

/** 채점 직후 정답 표시 */
function showFeedback(q, correct, choiceIndex) {
  const title = $('#quiz-feedback-title');
  title.textContent = correct ? '⭕ 정답!' : '❌ 오답';
  title.className = 'feedback-title ' + (correct ? 'ok' : 'bad');
  $('#quiz-feedback-answer').textContent = q.dir === 'en2ko'
    ? `정답: ${q.meanings.join(', ')}`
    : `정답: ${q.word}  (${q.meanings.join(', ')})`;
  $('#quiz-feedback-memo').textContent = q.memo || '';
  $('#quiz-feedback-memo').hidden = !q.memo;
  // 주관식 오답일 때만 "정답 인정" 버튼 표시
  $('#quiz-accept-btn').hidden = correct || q.type !== 'input';
  $('#quiz-next-btn').textContent = quiz.index + 1 >= quiz.questions.length ? '결과 보기 (Enter)' : '다음 (Enter)';
  $('#quiz-speak-btn').hidden = false;
  $('#quiz-feedback').hidden = false;

  if (q.type === 'input') {
    const input = $('#quiz-answer');
    input.readOnly = true; // 포커스는 유지해서 키보드 Enter로 바로 다음 문제로
    input.className = 'quiz-answer ' + (correct ? 'correct' : 'wrong');
    $('#quiz-submit-btn').hidden = true;
  } else {
    $$('#quiz-choices .choice').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correctIndex) btn.classList.add('correct');
      else if (i === choiceIndex) btn.classList.add('wrong');
    });
  }
}

/** "정답 인정" — 오답을 정답으로 수동 정정 */
function acceptAnswer() {
  const last = quiz && quiz.answers[quiz.answers.length - 1];
  if (!last || last.correct) return;
  last.correct = true;
  last.accepted = true;
  const title = $('#quiz-feedback-title');
  title.textContent = '⭕ 정답 인정';
  title.className = 'feedback-title ok';
  $('#quiz-answer').className = 'quiz-answer correct';
  $('#quiz-accept-btn').hidden = true;
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
  else if (choice === 'discard') { quiz = null; showTestPanel('setup'); }
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
  startTest(words);
}

/* ---------- 테스트 설정 화면 ---------- */

/** 세그먼트 버튼에 현재 설정 표시 + 출제 개수 안내 */
function renderTestSetup() {
  $$('#test-setup .segmented').forEach(seg => {
    const key = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === state.settings[key]));
  });
  const total = state.words.length;
  const n = Math.min(state.settings.count, total);
  let info = total === 0
    ? '저장된 단어가 없습니다. 먼저 단어를 등록하세요.'
    : `저장된 단어 ${total}개 중 ${n}문제 출제 (출제 개수는 ‘설정’ 탭에서 변경)`;
  if (state.settings.format === 'choice' && total > 0 && total < 4) info += '\n※ 단어가 4개 미만이면 객관식 보기 수가 줄어듭니다.';
  $('#test-count-info').textContent = info;
  $('#start-test-btn').disabled = total === 0;
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
  // 출제 방향/형식/모드 선택 → 설정에 저장
  $$('#test-setup .segmented').forEach(seg => {
    seg.addEventListener('click', e => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      state.settings[seg.dataset.setting] = btn.dataset.value;
      saveSettings();
      renderTestSetup();
    });
  });

  $('#start-test-btn').addEventListener('click', () => startTest());
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
