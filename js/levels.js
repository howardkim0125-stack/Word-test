/* ============================================================
 * levels.js — 난이도 (초등 1 ~ 고등 3, 9단계)
 *  - 사전의 모든 단어에 난이도가 있음 (dict-data.js)
 *  - 난이도별 라이브러리: 라이브러리 홈 "난이도별 단어" → 미리 보기,
 *    골라 담기(카드 50장), 50개 담기, 통째로 추가 → 그 난이도 이름의 라이브러리에 모임
 *  - 내 수준(설정 userLevel): 추천 단어에 반영, 처음 쓸 때 고르도록 안내
 *  - 수준 진단: 단계마다 3문제씩 객관식 27문제 → 추천 수준
 * ============================================================ */

const LEVELS = [
  { lv: 1, name: '초등 1', short: '초1', group: '초등', desc: '가장 기초 단어 · 가족·색·숫자·동물·음식·기본 동작' },
  { lv: 2, name: '초등 2', short: '초2', group: '초등', desc: '생활 단어 · 날씨·장소·직업·시간·기본 형용사' },
  { lv: 3, name: '초등 3', short: '초3', group: '초등', desc: '초등 고학년 단어 · 위치·감정·학교·생활 동작' },
  { lv: 4, name: '중등 1', short: '중1', group: '중등', desc: '중학교 1학년 기본 어휘' },
  { lv: 5, name: '중등 2', short: '중2', group: '중등', desc: '중학교 2학년 어휘' },
  { lv: 6, name: '중등 3', short: '중3', group: '중등', desc: '중학교 3학년 · 고등 대비 어휘' },
  { lv: 7, name: '고등 1', short: '고1', group: '고등', desc: '고1 · 모의고사 기본 어휘' },
  { lv: 8, name: '고등 2', short: '고2', group: '고등', desc: '고2 · 수능 핵심 어휘' },
  { lv: 9, name: '고등 3', short: '고3', group: '고등', desc: '고3 · 수능 고난도·심화 어휘' }
];
const LEVEL_GROUPS = [
  { name: '초등', key: 'el', color: 1 },
  { name: '중등', key: 'mid', color: 4 },
  { name: '고등', key: 'high', color: 5 }
];
const LEVEL_BATCH = 50;       // "50개 담기", 골라 담기 카드 수
const DIAG_PER_LEVEL = 3;     // 수준 진단: 단계마다 문제 수

function levelInfo(lv) { return LEVELS[lv - 1] || null; }
function levelName(lv) { return levelInfo(lv)?.name || ''; }
function levelShort(lv) { return levelInfo(lv)?.short || ''; }
function levelGroupOf(lv) { return LEVEL_GROUPS.find(g => g.name === levelInfo(lv)?.group) || LEVEL_GROUPS[0]; }

/** 단어 옆 난이도 배지 (사전에 없는 단어는 빈 문자열) */
function levelBadgeHtml(word) {
  const lv = dictLevel(word);
  return lv ? `<span class="lv-badge lv-${levelGroupOf(lv).key}" title="${levelName(lv)}">${levelShort(lv)}</span>` : '';
}

let levelEntryCache = null;
/** 난이도별 사전 항목 (알파벳순, 처음 한 번만 나눔) */
function levelEntries(lv) {
  if (!levelEntryCache) {
    levelEntryCache = Array.from({ length: 10 }, () => []);
    getDictIndex().map.forEach(e => { if (e.level >= 1 && e.level <= 9) levelEntryCache[e.level].push(e); });
  }
  return levelEntryCache[lv] || [];
}

/* ---------- 난이도 팩 (단어팩과 같은 모양이라 미리 보기·골라 담기·통째로 추가를 같이 씀) ---------- */

let levelPacks = null;
function getLevelPacks() {
  if (!levelPacks) {
    levelPacks = LEVELS.map(L => ({ id: `level-${L.lv}`, level: L.lv, name: L.name, desc: L.desc, color: levelGroupOf(L.lv).color, words: '' }));
  }
  return levelPacks;
}

/** 난이도 팩의 ID인지 (level-1 ~ level-9) */
function isLevelPackId(packId) {
  return /^level-[1-9]$/.test(String(packId || ''));
}

/** 단어팩 찾기 (난이도 팩 포함) */
function findPack(packId) {
  return getLevelPacks().find(p => p.id === packId) || WORD_PACKS.find(p => p.id === packId) || null;
}

/** 내 단어장의 단어 키 모음 (많은 단어를 한꺼번에 확인할 때) */
function myWordKeySet() {
  return new Set(state.words.map(w => wordKey(w.word)));
}

/** 난이도마다 내 단어 수와 외운 수 → [{ mine, known }] (번호 = 난이도) */
function myLevelCounts() {
  const out = Array.from({ length: 10 }, () => ({ mine: 0, known: 0 }));
  state.words.forEach(w => {
    const lv = dictLevel(w.word);
    if (!lv) return;
    out[lv].mine++;
    if (masteryOf(w) === 'known') out[lv].known++;
  });
  return out;
}

/** 단어팩의 아직 라이브러리에 없는 단어 (난이도 팩의 50개 담기·골라 담기용) */
function packItemsNotInLibrary(pack) {
  const lib = installedLibraryOfPack(pack.id);
  const inLib = new Set((lib ? libraryWords(lib.id) : []).map(w => wordKey(w.word)));
  return packWordList(pack).filter(it => !inLib.has(wordKey(it.word)));
}

/** 50개 담기: 아직 안 담은 단어 중 무작위로 n개를 그 난이도 라이브러리에 */
function addPackBatch(pack, n = LEVEL_BATCH) {
  const rest = packItemsNotInLibrary(pack);
  if (!rest.length) { showToast(`${pack.name} 단어를 모두 담았어요.`); return null; }
  const r = addPackItems(pack, shuffle(rest).slice(0, n));
  touchLibrary(r.lib.id);
  showToast(`'${r.lib.name}'에 ${r.created + r.linked}개 담음 · 남은 단어 ${rest.length - r.created - r.linked}개`, 3500);
  return r;
}

/* ---------- 라이브러리 홈: 난이도별 단어 ---------- */

function renderLevelSection() {
  const counts = myLevelCounts();
  const my = state.settings.userLevel;
  $('#my-level-btn').textContent = my ? `내 수준: ${levelName(my)}` : '내 수준 고르기';
  $('#level-grid').innerHTML = LEVEL_GROUPS.map(g => `
    <div class="level-row">
      <span class="level-group">${g.name}</span>
      ${LEVELS.filter(L => L.group === g.name).map(L => {
        const total = levelEntries(L.lv).length;
        const c = counts[L.lv];
        const pct = n => (total ? Math.min(100, (n / total) * 100) : 0).toFixed(1);
        const installed = installedLibraryOfPack(`level-${L.lv}`);
        return `
        <button class="level-card lv-${g.key}${my === L.lv ? ' mine' : ''}" data-pack="level-${L.lv}">
          <span class="level-name">${L.name}${my === L.lv ? '<em class="level-mine">내 수준</em>' : ''}</span>
          <span class="level-meta">단어 ${total.toLocaleString()} · 내 단어 ${c.mine}${installed ? ' · ✓' : ''}</span>
          <span class="level-bar" aria-hidden="true"><i style="width:${pct(c.mine)}%"></i><b style="width:${pct(c.known)}%"></b></span>
        </button>`;
      }).join('')}
    </div>`).join('');
  $('#level-prompt').hidden = !!my || !!state.meta.levelPromptDismissed;
}

/* ---------- 내 수준 ---------- */

function setUserLevel(lv) {
  state.settings.userLevel = lv;
  saveSettings();
  showToast(lv ? `내 수준: ${levelName(lv)}` : '내 수준 선택을 지웠어요');
  if (!$('#view-list').hidden) onEnterLibraryView();
  if (!$('#view-settings').hidden) renderSettings();
}

/** 내 수준 고르기 (9단계 버튼 + 수준 진단) */
async function openLevelPicker() {
  const cur = state.settings.userLevel;
  const html = `
    <p class="hint">고른 수준에 맞춰 추천 단어를 보여 드려요. 잘 모르겠으면 수준 진단(객관식 ${LEVELS.length * DIAG_PER_LEVEL}문제)을 해 보세요.</p>
    <div class="level-pick">${LEVEL_GROUPS.map(g => `
      <div class="level-pick-row"><span class="level-group">${g.name}</span>
        ${LEVELS.filter(L => L.group === g.name).map(L =>
          `<button type="button" class="btn${cur === L.lv ? ' btn-primary' : ''}" data-pick-level="${L.lv}">${L.name}</button>`).join('')}
      </div>`).join('')}</div>`;
  let picked = 0;
  const v = await showDialog({
    title: '내 수준 고르기',
    html,
    buttons: [{ label: '닫기', value: null }, { label: '수준 진단', value: 'diag', primary: !cur }],
    onOpen: body => {
      body.onclick = e => {
        const b = e.target.closest('[data-pick-level]');
        if (!b) return;
        picked = Number(b.dataset.pickLevel);
        closeDialog();
      };
    }
  });
  if (picked) setUserLevel(picked);
  else if (v === 'diag') startDiagnostic();
}

/* ---------- 수준 진단 ---------- */

/** 진단 문제 하나 (영→한 객관식, 오답 보기는 같은 난이도의 다른 단어 뜻) */
function diagQuestion(entry, pool) {
  const text = e => e.meanings.slice(0, 2).join(', ');
  const correct = text(entry);
  const used = new Set([correct]);
  const distractors = [];
  for (const o of pool) {
    if (distractors.length >= 3) break;
    const t = text(o);
    if (o === entry || used.has(t) || meaningsOverlap(o, entry)) continue;
    used.add(t);
    distractors.push(t);
  }
  const choices = shuffle([correct, ...distractors]);
  return {
    wordId: '', word: entry.word, meanings: entry.meanings.slice(0, 2), memo: '', dir: 'en2ko', type: 'choice',
    prompt: entry.word, answerText: correct, choices, correctIndex: choices.indexOf(correct), level: entry.level
  };
}

/** 수준 진단 시작: 쉬운 단계부터 단계마다 3문제 (기록·통계에는 남기지 않음) */
async function startDiagnostic() {
  if (!(await confirmDiscardRun())) return;
  const questions = [];
  LEVELS.forEach(L => {
    const pool = shuffle(levelEntries(L.lv).filter(e => !e.word.includes(' ') && e.meanings.length));
    pool.slice(0, DIAG_PER_LEVEL).forEach(e => questions.push(diagQuestion(e, pool)));
  });
  quiz = {
    questions, index: 0, answers: [], phase: 'answer', gradedAt: 0,
    scope: [], scopeName: '수준 진단', settings: { direction: 'en2ko', format: 'choice', mode: 'random', count: questions.length },
    startedAt: Date.now(), retry: false, diagnostic: true
  };
  switchTab('test');
  showTestPanel('run');
  renderQuestion();
}

/**
 * 추천 수준: 찍어서 맞힌 것을 빼고(오답 3개당 1개, "모르겠어요"는 빼지 않음)
 * 맞힌 문제 3개마다 한 단계 → 다 아는 단계의 다음 단계
 */
function diagnosticLevel(answers) {
  const correct = answers.filter(a => a.correct).length;
  const wrong = answers.filter(a => !a.correct && !a.dunno).length;
  return Math.max(1, Math.min(9, Math.floor((correct - wrong / 3) / DIAG_PER_LEVEL) + 1));
}

/** 진단 결과 화면 (시험 결과 화면을 같이 씀) */
function finishDiagnostic() {
  const answers = quiz.answers;
  const rec = diagnosticLevel(answers);
  quiz.diagLevel = rec;
  quiz.phase = 'done';
  $('#quiz-answer').blur();

  const correct = answers.filter(a => a.correct).length;
  $('#result-score').textContent = `추천 수준: ${levelName(rec)}  (${correct} / ${answers.length})`;
  const rows = LEVELS.map(L => {
    const list = answers.filter(a => a.question.level === L.lv);
    if (!list.length) return '';
    const dots = list.map(a => `<i class="diag-dot ${a.correct ? 'ok' : a.dunno ? 'skip' : 'bad'}" title="${escapeHtml(a.question.word)}"></i>`).join('');
    return `<li class="${L.lv === rec ? 'rec' : ''}"><span>${L.name}</span><span class="diag-dots">${dots}</span>
      <span class="diag-words">${list.map(a => escapeHtml(a.question.word)).join(', ')}</span></li>`;
  }).join('');
  $('#diag-result').innerHTML = `<ul class="diag-list">${rows}</ul>
    <p class="hint diag-legend"><i class="diag-dot ok"></i> 맞힘 · <i class="diag-dot bad"></i> 틀림 · <i class="diag-dot"></i> 모르겠어요 — 찍어서 맞힌 몫은 빼고 계산했어요. 수준은 설정에서 언제든 바꿀 수 있어요.</p>`;
  $('#diag-result').hidden = false;

  const wrong = answers.filter(a => !a.correct);
  $('#result-wrong-body').innerHTML = wrong.map(a => `
    <tr>
      <td>${escapeHtml(a.question.prompt)}</td>
      <td class="mine">${escapeHtml(a.userAnswer || '(모르겠어요)')}</td>
      <td class="answer">${escapeHtml(a.question.answerText)}</td>
      <td class="speak-cell"><button class="icon-btn" data-speak="${escapeHtml(a.question.word)}" aria-label="${escapeHtml(a.question.word)} 발음 듣기">🔊</button></td>
    </tr>`).join('');
  $('#result-wrong-wrap').hidden = wrong.length === 0;
  $('#result-perfect').hidden = wrong.length > 0 || answers.length === 0;
  ['#retry-wrong-btn', '#retry-all-btn', '#wrong-note-btn', '#mark-known-btn'].forEach(s => { $(s).hidden = true; });
  const apply = $('#diag-apply-btn');
  apply.hidden = false;
  apply.disabled = state.settings.userLevel === rec;
  apply.textContent = state.settings.userLevel === rec ? `내 수준이 이미 ${levelName(rec)}이에요` : `내 수준을 ${levelName(rec)}(으)로 설정`;
  showTestPanel('result');
}

/* ---------- 통계: 난이도별 내 단어 ---------- */

function levelStatsHtml() {
  const counts = myLevelCounts();
  const max = Math.max(1, ...counts.map(c => c.mine));
  const none = state.words.filter(w => !dictLevel(w.word)).length;
  if (!state.words.length) return '<p class="empty">단어가 없어요.</p>';
  return `<ul class="level-stats">${LEVELS.map(L => {
    const c = counts[L.lv];
    return `<li><span class="ls-name">${L.short}</span>
      <span class="ls-bar"><i class="lv-${levelGroupOf(L.lv).key}" style="width:${((c.mine / max) * 100).toFixed(1)}%"></i></span>
      <span class="ls-num">${c.mine}${c.known ? ` <small>외움 ${c.known}</small>` : ''}</span></li>`;
  }).join('')}</ul>${none ? `<p class="hint">사전에 없는 단어 ${none}개는 빠져 있어요.</p>` : ''}`;
}

function initLevels() {
  $('#level-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-pack]');
    if (card) openPackPreview(card.dataset.pack);
  });
  $('#my-level-btn').addEventListener('click', openLevelPicker);
  $('#level-prompt-pick').addEventListener('click', openLevelPicker);
  $('#level-prompt-diag').addEventListener('click', startDiagnostic);
  $('#level-prompt-close').addEventListener('click', () => {
    state.meta.levelPromptDismissed = Date.now();
    saveMeta();
    $('#level-prompt').hidden = true;
  });
  $('#diag-apply-btn').addEventListener('click', () => {
    if (!quiz || !quiz.diagLevel) return;
    setUserLevel(quiz.diagLevel);
    $('#diag-apply-btn').disabled = true;
  });
  $('#setting-user-level').addEventListener('change', e => setUserLevel(Number(e.target.value) || 0));
  $('#setting-diag-btn').addEventListener('click', startDiagnostic);
}
