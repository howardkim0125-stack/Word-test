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
  renderDefaultLibrarySelect();
  renderBackupInfo();
  $('#app-version').textContent = `버전 ${APP_VERSION} · 단어 ${state.words.length}개`;
}

/** 기본 라이브러리 선택 상자 (없으면 "외울 단어"를 처음 담을 때 만듦) */
function renderDefaultLibrarySelect() {
  const sel = $('#setting-default-lib');
  const def = getDefaultLibrary();
  fillLibrarySelect(sel, { selected: def ? def.id : '' });
  if (!def) {
    sel.insertBefore(new Option(`${DEFAULT_LIB_NAME} (처음 담을 때 자동으로 만들어요)`, ''), sel.firstChild);
    sel.value = '';
  }
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
  $('#setting-default-lib').addEventListener('change', e => {
    state.settings.defaultLibrary = e.target.value;
    saveSettings();
    showToast(`기본 라이브러리: ${defaultLibraryName()}`);
  });
  $('#refresh-app-btn').addEventListener('click', refreshAppCache);
  $('#add-samples-btn').addEventListener('click', () => { addSampleWords(); renderSettings(); });
  $('#remove-samples-btn').addEventListener('click', async () => { await removeSampleWords(); renderSettings(); });
  $('#reset-stats-btn').addEventListener('click', resetAllStats);
  $('#delete-all-btn').addEventListener('click', deleteAllWords);
}

/* ---------- 서비스 워커 (오프라인 동작, 업데이트) ---------- */

let swRegistration = null;
let waitingWorker = null;   // 설치돼서 기다리는 새 버전
let updateRequested = false; // "지금 적용"을 눌렀을 때만 새로고침 (처음 설치 때는 안 함)

/** "새 버전이 있어요 · 지금 적용" 배너 */
function showUpdateBanner(worker) {
  waitingWorker = worker;
  $('#update-banner').hidden = false;
}

/** 기다리던 새 버전으로 교체 → controllerchange에서 새로고침 */
function applyUpdate() {
  if (!waitingWorker) { location.reload(); return; }
  updateRequested = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  // 혹시 교체 신호가 안 오면 잠시 뒤 직접 새로고침
  setTimeout(() => location.reload(), 3000);
}

function watchForUpdate(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker && worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
    });
  });
}

/**
 * 설정 → "앱 새로고침(캐시 갱신)": 저장해 둔 앱 파일을 지우고 새로 받음 (단어 데이터는 그대로)
 */
async function refreshAppCache() {
  if (!navigator.onLine) { showToast('인터넷에 연결된 상태에서 눌러 주세요.'); return; }
  showToast('새로 받는 중…', 5000);
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('wordbook-')).map(k => caches.delete(k)));
    }
    if (swRegistration) {
      await swRegistration.update().catch(() => {});
      const worker = swRegistration.waiting || swRegistration.installing;
      if (worker) { waitingWorker = worker; applyUpdate(); return; }
    }
  } catch (e) {
    console.warn('캐시 갱신 실패:', e);
  }
  location.reload();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      swRegistration = reg;
      watchForUpdate(reg);
      // 홈 화면 앱은 오래 켜 두므로 다시 볼 때마다 새 버전 확인
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
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
  $('#update-apply-btn').addEventListener('click', applyUpdate);

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
