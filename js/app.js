/* ============================================================
 * app.js — 앱 시작, 탭 전환, 설정 화면, 서비스 워커 등록
 * ============================================================ */

const APP_VERSION = '1.1.0';
const TAB_KEY = 'wt.tab';

/* ---------- 탭 전환 ---------- */

function switchTab(name) {
  $$('.tab').forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active);
  });
  $$('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  try { sessionStorage.setItem(TAB_KEY, name); } catch (e) { /* 무시 */ }

  // 탭에 들어올 때 최신 데이터로 다시 그리기
  if (name === 'list') onEnterLibraryView();
  else if (name === 'add') renderAddLibrarySelect();
  else if (name === 'test') onEnterTestView();
  else if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

/** 데이터가 크게 바뀌었을 때(가져오기 등) 전체 화면 갱신 */
function refreshAllViews() {
  if (currentLibId !== 'all' && !getLibrary(currentLibId)) showLibraryHome();
  onEnterLibraryView();
  renderAddLibrarySelect();
  renderSettings();
  renderTestSetup();
  updateBackupBanner();
}

/* ---------- 설정 화면 ---------- */

function renderSettings() {
  $('#setting-count').value = state.settings.count;
  renderBackupInfo();
  $('#app-version').textContent = `버전 ${APP_VERSION} · 단어 ${state.words.length}개`;
}

/** 출제 개수 저장 (1~500 사이로 제한) */
function setQuestionCount(value) {
  const n = Math.min(500, Math.max(1, parseInt(value, 10) || DEFAULT_SETTINGS.count));
  state.settings.count = n;
  saveSettings();
  $('#setting-count').value = n;
}

async function resetAllStats() {
  const ok = await confirmDialog('통계 초기화', '모든 단어의 출제 횟수·오답 횟수를 0으로 되돌릴까요?', '초기화', true);
  if (!ok) return;
  state.words.forEach(w => { w.asked = 0; w.wrong = 0; w.lastTested = null; });
  saveWords();
  showToast('통계를 초기화했습니다.');
}

async function deleteAllWords() {
  if (state.words.length === 0) { showToast('삭제할 단어가 없습니다.'); return; }
  const ok = await confirmDialog('모든 단어 삭제', `단어 ${state.words.length}개를 모두 삭제할까요?\n먼저 JSON 내보내기로 백업하는 것을 권장합니다.`, '모두 삭제', true);
  if (!ok) return;
  const ok2 = await confirmDialog('정말 삭제할까요?', '삭제하면 되돌릴 수 없습니다.', '삭제', true);
  if (!ok2) return;
  state.words = [];
  saveWords();
  state.libraries.forEach(l => { l.wordIds = []; }); // 라이브러리는 남기고 비움
  saveLibraries();
  refreshAllViews();
  showToast('모든 단어를 삭제했습니다.');
}

function initSettingsView() {
  $('#setting-count').addEventListener('change', e => setQuestionCount(e.target.value));
  $$('.stepper [data-step]').forEach(btn => {
    btn.addEventListener('click', () => setQuestionCount(state.settings.count + Number(btn.dataset.step)));
  });
  $('#add-samples-btn').addEventListener('click', () => { addSampleWords(); renderSettings(); });
  $('#remove-samples-btn').addEventListener('click', async () => { await removeSampleWords(); renderSettings(); });
  $('#reset-stats-btn').addEventListener('click', resetAllStats);
  $('#delete-all-btn').addEventListener('click', deleteAllWords);
}

/* ---------- 서비스 워커 (오프라인 동작) ---------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // 새 버전이 설치되면 알려 주기
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker && worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('새 버전이 준비되었습니다. 앱을 다시 열면 적용됩니다.', 4000);
          }
        });
      });
    }).catch(err => console.warn('서비스 워커 등록 실패:', err));
  });
}

/* ---------- 앱 시작 ---------- */

function init() {
  loadAll();
  requestPersistentStorage();
  initSpeech();

  initAddView();
  initLibraryView();
  initListView();
  initTestView();
  initSettingsView();
  initBackup();

  $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  let startTab = 'add';
  try { startTab = sessionStorage.getItem(TAB_KEY) || (state.words.length ? 'test' : 'add'); } catch (e) { /* 무시 */ }
  switchTab(startTab);

  // 다른 탭/창에서 데이터가 바뀌면 다시 불러오기
  window.addEventListener('storage', e => {
    if (e.key && e.key.startsWith('wt.')) { loadAll(); refreshAllViews(); }
  });

  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
