/* ============================================================
 * ui.js — 공용 UI 도우미 (토스트, 대화상자, HTML 이스케이프 등)
 * ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** 사용자 입력을 HTML에 넣기 전에 이스케이프 */
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 화면 아래에 잠깐 메시지 표시
 * @param {object} [action] { label, onClick } — "되돌리기", "변경" 같은 버튼을 붙일 때
 */
let toastTimer = null;
function showToast(message, ms = 2200, action = null) {
  const el = $('#toast');
  const btn = $('#toast-action');
  $('#toast-text').textContent = message;
  btn.hidden = !action;
  btn.onclick = null;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => { hideToast(); action.onClick(); };
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
}

function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').hidden = true;
  $('#toast-action').onclick = null;
}

/**
 * 대화상자 표시 (window.confirm 대신 사용 — 태블릿에서 버튼이 큼)
 * @param {object} opts
 *   - title: 제목
 *   - message: 본문 텍스트 (또는 html: 본문 HTML)
 *   - buttons: [{ label, value, primary, danger }]
 *   - onOpen: 열린 직후 호출 (입력칸 포커스 등)
 *   - beforeClose: (value) => true면 닫기, false면 유지 (입력 검증용)
 * @returns {Promise<any>} 누른 버튼의 value (바깥 클릭/Esc는 null)
 */
function showDialog({ title = '', message = '', html = null, buttons = [{ label: '확인', value: true, primary: true }], onOpen, beforeClose, sheet = false } = {}) {
  return new Promise(resolve => {
    const modal = $('#modal');
    const body = $('#modal-body');
    const actions = $('#modal-actions');
    modal.classList.toggle('is-sheet', sheet); // 액션 시트: 버튼을 세로로 길게
    $('#modal-title').textContent = title;
    if (html !== null) body.innerHTML = html; else body.textContent = message;
    body.classList.toggle('is-html', html !== null); // HTML 본문은 줄바꿈을 그대로 보이지 않게
    body.onchange = null; // 이전 대화상자가 남긴 이벤트 처리 지우기
    body.onclick = null;
    actions.innerHTML = '';

    const close = (value) => {
      if (beforeClose && value !== null && beforeClose(value) === false) return;
      modal.hidden = true;
      modal.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
    };

    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (b.primary ? ' btn-primary' : '') + (b.danger ? ' btn-danger' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => close(b.value));
      actions.appendChild(btn);
    });

    modal.onclick = (e) => { if (e.target === modal) close(null); };
    document.addEventListener('keydown', onKey);
    modal.hidden = false;
    if (onOpen) onOpen(body);
  });
}

/**
 * 액션 시트 (⋯ 메뉴 등) — 고른 항목의 value 반환, 취소는 null
 * @param {Array<{label, value, danger}>} items
 */
function showSheet(title, items) {
  return showDialog({
    title,
    sheet: true,
    buttons: [...items.map(it => ({ label: it.label, value: it.value, danger: it.danger })), { label: '취소', value: null }]
  });
}

/** 열려 있는 대화상자를 코드에서 닫기 (값 없이) */
function closeDialog() {
  const modal = $('#modal');
  if (!modal.hidden && modal.onclick) modal.onclick({ target: modal });
}

/** 예/아니오 확인 대화상자 */
function confirmDialog(title, message, okLabel = '확인', danger = false) {
  return showDialog({
    title,
    message,
    buttons: [
      { label: '취소', value: false },
      { label: okLabel, value: true, primary: !danger, danger }
    ]
  }).then(v => v === true);
}

/** 타임스탬프 → "2026. 10. 21. 14:05" 형식 */
function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 타임스탬프 → "10/21" 형식 */
function formatShortDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 두 문자열의 편집 거리 (철자 비교용, 레벤슈타인) */
function editDistance(a, b) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 배열을 무작위로 섞은 새 배열 반환 (Fisher–Yates) */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
