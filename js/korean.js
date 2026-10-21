/* ============================================================
 * korean.js — 한국어 뜻 비교 (주관식 채점, 한글로 사전 찾기)
 *  - 품사가 같은 꼴만 같은 답으로 봄
 *    · 동사·형용사: 포기하다 = 포기한다 = 포기하는, 행복한 = 행복하다,
 *                   아름다운 = 아름답다, 긴 = 길다, 하얀 = 하얗다, 있는 = 있다
 *    · 경제적인 = 경제적 = 경제적이다 · 사람들 = 사람
 *  - 품사가 바뀌는 꼴은 다른 답: 포기하다 ≠ 포기, 중요한 ≠ 중요함, 행복 ≠ 행복한
 *    → 오답이지만 "품사가 달라요" 안내 (정답 인정 버튼으로 직접 인정할 수 있음)
 * ============================================================ */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
// 받침 번호: ㄴ 4, ㄹ 8, ㅁ 16, ㅂ 17, ㅆ 20, ㅎ 27
const JONG_N = 4, JONG_L = 8, JONG_M = 16, JONG_B = 17, JONG_SS = 20, JONG_H = 27;

function isHangulSyllable(ch) {
  const c = ch ? ch.charCodeAt(0) : 0;
  return c >= HANGUL_FIRST && c <= HANGUL_LAST;
}

/** 글자의 받침 번호 (한글이 아니면 -1) */
function jongOf(ch) {
  return isHangulSyllable(ch) ? (ch.charCodeAt(0) - HANGUL_FIRST) % 28 : -1;
}

/** 받침을 바꾼 글자 (jong 0 = 받침 없음) */
function withJong(ch, jong) {
  const c = ch.charCodeAt(0) - HANGUL_FIRST;
  return String.fromCharCode(HANGUL_FIRST + c - (c % 28) + jong);
}

/** 비교용으로 다듬기: 소문자, 괄호 속 말, "~을/를" 같은 표시, 띄어쓰기·문장부호 제거 */
function koClean(text) {
  return String(text ?? '').trim().toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/~\s*(을|를|이|가|은|는|에게|에서|에|와|과|의|으로|로)?/g, '')
    .replace(/[\s.·…!?'"‘’“”]/g, '');
}

/** 뜻의 품사를 끝말로 짐작 (사전에서 품사를 못 찾았을 때) */
function guessKoreanPos(text) {
  const t = koClean(text);
  if (!t) return 'n';
  if (/다$/.test(t)) return 'v';
  if (t.length >= 2 && /(게|히)$/.test(t)) return 'ad';
  if (/(적인|의|한|된|인|운|은|는|던|진|난|린|른|쁜|픈|큰|긴|흰|센|싼|짠)$/.test(t)) return 'a';
  return 'n';
}

/**
 * 동사·형용사의 기본형(…다) 후보
 *  포기한다/포기하는/포기한 → 포기하다, 먹는다 → 먹다, 작은 → 작다, 사는 → 살다,
 *  아름다운 → 아름답다, 긴 → 길다, 하얀 → 하얗다
 */
function predicateForms(t) {
  const out = [];
  const last = t[t.length - 1];
  const head = t.slice(0, -1);
  const prev = head[head.length - 1];
  if (last === '다') {
    out.push(t);
    if (t.length >= 3 && prev === '는') out.push(t.slice(0, -2) + '다');
    if (t.length >= 3 && jongOf(prev) === JONG_N) {
      const h2 = t.slice(0, -2);
      out.push(h2 + withJong(prev, 0) + '다', h2 + withJong(prev, JONG_L) + '다');
    }
    return out;
  }
  if (!isHangulSyllable(last) || !head) {
    if (jongOf(last) === JONG_N) out.push(withJong(last, 0) + '다', withJong(last, JONG_L) + '다', withJong(last, JONG_H) + '다');
    return out;
  }
  if (last === '는' || last === '은') {
    out.push(head + '다');
    // ㄹ로 끝나는 말: 사는 → 살다, 만드는 → 만들다
    if (last === '는' && jongOf(prev) === 0) out.push(head.slice(0, -1) + withJong(prev, JONG_L) + '다');
    return out;
  }
  if (jongOf(last) === JONG_N) {
    out.push(head + withJong(last, 0) + '다', head + withJong(last, JONG_L) + '다', head + withJong(last, JONG_H) + '다');
    // ㅂ 불규칙: 아름다운 → 아름답다, 어려운 → 어렵다
    if (last === '운' && isHangulSyllable(prev)) out.push(head.slice(0, -1) + withJong(prev, JONG_B) + '다');
  }
  return out;
}

/**
 * 같은 답으로 보는 꼴들 (비교 열쇠 목록)
 * @param pos 뜻의 품사를 알면 넘김 (동사·형용사만 기본형 후보를 만듦). 'any'면 품사와 상관없이 만듦(사용자 답)
 */
function koForms(text, pos = null) {
  const t = koClean(text);
  if (!t) return [];
  const out = new Set([t]);
  if (/적인$/.test(t) && t.length >= 4) out.add(t.slice(0, -1));
  if (/적이다$/.test(t) && t.length >= 5) out.add(t.slice(0, -2));
  if (/들$/.test(t) && t.length >= 3) out.add(t.slice(0, -1));
  const p = pos || guessKoreanPos(text);
  if (p === 'v' || p === 'a' || p === 'any') predicateForms(t).forEach(f => out.add(f));
  return [...out];
}

// 품사를 바꾸는 끝말 (긴 것부터) — "포기하다"와 "포기", "중요한"과 "중요함"이 같은 말에서 나온 것인지 볼 때
const KO_ENDINGS = ['적으로', '적이다', '스럽게', '스러운', '스럽다', '스러움', '시키다', '하다', '되다', '하기', '하게',
  '하는', '한다', '하고', '하여', '해서', '되는', '되기', '적인', '로운', '롭게', '롭다', '로움', '다운', '답게', '답다',
  '함', '한', '히', '해', '된', '됨', '게', '기', '음', '성', '적', '의', '운', '움', '은', '는', '이', '다'];
const KO_HA_ENDINGS = new Set(['하다', '되다', '하기', '하게', '하는', '한다', '하고', '하여', '해서', '되는', '되기', '함', '한', '히', '해', '된', '됨', '시키다']);

/** 끝말을 떼어 본 어간 후보 [{ core, end }] (받침 ㄴ·ㄹ·ㅁ·ㅂ·ㅆ 차이는 같은 어간으로) */
function koCores(key) {
  const out = [{ core: key, end: '' }];
  KO_ENDINGS.forEach(e => { if (key.length > e.length && key.endsWith(e)) out.push({ core: key.slice(0, -e.length), end: e }); });
  return out.map(({ core, end }) => {
    const last = core[core.length - 1];
    const j = jongOf(last);
    const norm = [JONG_N, JONG_L, JONG_M, JONG_B, JONG_SS].includes(j) ? core.slice(0, -1) + withJong(last, 0) : core;
    return { core: norm, end };
  });
}

/** 같은 말에서 품사만 바뀐 꼴인지 (포기하다 ↔ 포기, 아름다운 ↔ 아름다움) */
function koSameRoot(a, b) {
  const ca = koCores(a), cb = koCores(b);
  return ca.some(x => cb.some(y => {
    if (!x.core || x.core !== y.core || x.end === y.end) return false;
    // 한 글자 어간은 "일 ↔ 일하다"처럼 하다·되다 계열일 때만
    return x.core.length >= 2 || KO_HA_ENDINGS.has(x.end) || KO_HA_ENDINGS.has(y.end);
  }));
}

/* ---------- 단어의 뜻과 품사 ---------- */

/** 뜻 하나의 품사: 사전에서 그 뜻이 든 품사 → 없으면 끝말로 짐작 */
function posOfMeaning(word, meaning, entry = dictGet(word)) {
  const k = koClean(meaning);
  if (entry && entry.senses) {
    const s = entry.senses.find(se => se.pos && se.meanings.some(m => koClean(m) === k));
    if (s) return s.pos;
    // 숙어는 뜻이 무엇이든 숙어
    if (entry.pos === 'ph') return 'ph';
  }
  return guessKoreanPos(meaning);
}

/** 내 단어의 뜻을 품사별로 묶기 (순서 유지) → [{ pos, meanings }] */
function meaningGroups(word, meanings) {
  const entry = dictGet(word);
  const groups = [];
  meanings.forEach(m => {
    const pos = posOfMeaning(word, m, entry);
    const g = groups.find(x => x.pos === pos);
    if (g) g.meanings.push(m); else groups.push({ pos, meanings: [m] });
  });
  return groups;
}

/** 품사 표시가 붙은 뜻 HTML: <span class="pos">동</span> 버리다, 포기하다 · … */
function meaningGroupsHtml(word, meanings) {
  const groups = meaningGroups(word, meanings);
  if (groups.length === 1 && !dictGet(word)) return escapeHtml(meanings.join(', ')); // 사전에 없는 단어는 짐작한 품사를 보이지 않음
  return groups.map(g => `<span class="pos-group">${POS_LABEL[g.pos] ? `<span class="pos">${POS_LABEL[g.pos]}</span> ` : ''}${escapeHtml(g.meanings.join(', '))}</span>`).join(' ');
}

/* ---------- 영→한 채점 ---------- */

/**
 * 한국어 답 채점 → { correct, near, note }
 *  - 내 뜻(쉼표로 여러 개 적었으면 하나라도) 중 같은 품사의 꼴이면 정답
 *  - 사전에 있는 다른 뜻이면 정답 (안내 표시)
 *  - 같은 말에서 품사만 바뀐 꼴이면 오답 + "품사가 달라요"
 *  - 한 글자만 다르면 "거의 정답"
 */
function gradeKoreanAnswer(word, meanings, userAnswer) {
  const entry = dictGet(word);
  const userParts = splitMeanings(userAnswer);
  const userKeys = new Set(userParts.flatMap(u => koForms(u, 'any')));
  if (!userKeys.size) return { correct: false };

  const mine = meanings.map(m => ({ m, pos: posOfMeaning(word, m, entry) }));
  const hit = list => list.find(c => koForms(c.m, c.pos).some(k => userKeys.has(k)));
  if (hit(mine)) return { correct: true };

  // 사전의 다른 뜻
  const extra = entry && entry.senses
    ? entry.senses.flatMap(s => s.meanings.map(m => ({ m, pos: s.pos }))).filter(c => !meanings.includes(c.m))
    : [];
  const dictHit = hit(extra);
  if (dictHit) return { correct: true, note: `사전에 있는 다른 뜻이에요 (${POS_NAME[dictHit.pos] || '뜻'})` };

  // 품사만 다른 꼴
  const userClean = userParts.map(koClean).filter(Boolean);
  for (const c of mine.concat(extra)) {
    const ck = koClean(c.m);
    if (ck && userClean.some(u => koSameRoot(u, ck))) {
      return { correct: false, posMismatch: true, note: `품사가 달라요 — ${POS_NAME[c.pos] || '다른 품사'} '${c.m}'(으)로 답해야 해요` };
    }
  }

  // 한 글자 차이
  const correctKeys = mine.flatMap(c => koForms(c.m, c.pos)).filter(k => k.length >= 2);
  const near = [...userKeys].some(u => correctKeys.some(k => editDistance(u, k) === 1));
  return near ? { correct: false, near: true, note: '한 글자만 달라요' } : { correct: false };
}

/** 영→한 주관식에서 어떤 품사로 답할지: "품사: 동사 · 명사" (사전에 없는 단어는 빈 문자열) */
function posHintText(word, meanings) {
  if (!dictGet(word)) return '';
  const names = meaningGroups(word, meanings).map(g => POS_NAME[g.pos]).filter(Boolean);
  return names.length ? `품사: ${names.join(' · ')}` : '';
}
