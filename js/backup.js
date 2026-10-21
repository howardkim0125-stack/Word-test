/* ============================================================
 * backup.js — JSON 내보내기/가져오기, 백업 알림
 * ============================================================ */

const BACKUP_REMIND_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 내보낼 백업 데이터 만들기 */
function buildBackupData() {
  return {
    app: 'word-test',
    version: 3,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    words: state.words,
    libraries: state.libraries,
    history: state.history
  };
}

/** 파일 이름: wordbook-backup-2026-10-21.json */
function backupFileName() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `wordbook-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** 백업 완료 기록 */
function markBackedUp() {
  state.meta.lastBackup = Date.now();
  saveMeta();
  renderBackupInfo();
  updateBackupBanner();
}

/**
 * JSON 내보내기
 *  - 아이패드(공유 시트 지원): 공유 시트 → "파일에 저장"으로 저장
 *  - 그 외: 파일 다운로드
 */
async function exportBackup() {
  if (state.words.length === 0) {
    const ok = await confirmDialog('내보내기', '저장된 단어가 없습니다. 그래도 내보낼까요?', '내보내기');
    if (!ok) return;
  }
  const json = JSON.stringify(buildBackupData(), null, 2);
  const fileName = backupFileName();
  const file = new File([json], fileName, { type: 'application/json' });

  const isTouchDevice = navigator.maxTouchPoints > 0;
  if (isTouchDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      markBackedUp();
      showToast('백업 파일을 저장했습니다.');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // 사용자가 공유 시트를 닫음
      console.warn('공유 실패, 다운로드로 대체:', e);
    }
  }

  // 일반 다운로드
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  markBackedUp();
  showToast('백업 파일을 내보냈습니다.');
}

/** 가져온 JSON에서 단어·라이브러리·시험 기록 꺼내기 (형식 검사, 버전 1·2 백업도 지원) */
function parseBackupJson(text) {
  const data = JSON.parse(text);
  const rawWords = Array.isArray(data) ? data : data && Array.isArray(data.words) ? data.words : null;
  if (!rawWords) throw new Error('단어 목록(words)을 찾을 수 없습니다.');
  const words = rawWords.map(normalizeWordRecord).filter(Boolean);
  const libraries = data && Array.isArray(data.libraries) ? data.libraries.map(normalizeLibrary).filter(Boolean) : [];
  const history = data && Array.isArray(data.history) ? data.history.map(normalizeHistoryEntry).filter(Boolean) : [];
  return { words, libraries, history, settings: data && data.settings ? data.settings : null };
}

/**
 * 가져온 라이브러리 합치기
 *  - idMap: 파일의 단어 ID → 현재 단어 ID (같은 단어가 이미 있으면 기존 ID)
 *  - 같은 ID 또는 같은 이름의 라이브러리가 있으면 단어만 합침
 */
function mergeLibraries(libraries, idMap) {
  libraries.forEach(imp => {
    const wordIds = imp.wordIds.map(id => idMap.get(id)).filter(Boolean);
    const existing = getLibrary(imp.id) || state.libraries.find(l => l.name === imp.name);
    if (existing) {
      existing.wordIds = [...new Set([...existing.wordIds, ...wordIds])];
    } else {
      state.libraries.push({ ...imp, wordIds });
    }
  });
}

/** 가져오기: 합치기 또는 전체 교체 */
async function importBackupFile(file) {
  let parsed;
  try {
    parsed = parseBackupJson(await file.text());
  } catch (e) {
    await showDialog({ title: '가져오기 실패', message: `올바른 백업 파일이 아닙니다.\n(${e.message})` });
    return;
  }
  const { words, libraries, history, settings } = parsed;
  if (words.length === 0) { showToast('파일에 단어가 없습니다.'); return; }

  const choice = await showDialog({
    title: '백업 가져오기',
    message: `파일에 단어 ${words.length}개, 라이브러리 ${libraries.length}개, 시험 기록 ${history.length}개가 있습니다. (현재 단어 ${state.words.length}개)\n\n` +
      '• 합치기: 현재 단어를 유지하고, 같은 단어는 파일 내용으로 바꿉니다.\n' +
      '• 전체 교체: 현재 단어를 모두 지우고 파일 내용으로 바꿉니다.',
    buttons: [
      { label: '취소', value: null },
      { label: '전체 교체', value: 'replace', danger: true },
      { label: '합치기', value: 'merge', primary: true }
    ]
  });
  if (!choice) return;

  if (choice === 'replace') {
    const ok = await confirmDialog('전체 교체', `현재 단어 ${state.words.length}개가 모두 삭제됩니다. 계속할까요?`, '교체', true);
    if (!ok) return;
    state.words = dedupeWords(words);
    state.libraries = libraries;
    state.history = history.slice(-HISTORY_MAX);
    pruneLibraryWordIds();
    if (settings) state.settings = normalizeSettings(settings);
    saveSettings();
  } else {
    let added = 0, updated = 0;
    const idMap = new Map();
    words.forEach(w => {
      const existing = findWord(w.word);
      if (existing) {
        // 같은 단어: 파일 내용(뜻·메모·통계)으로 바꾸되 ID는 유지
        Object.assign(existing, { ...w, id: existing.id });
        idMap.set(w.id, existing.id);
        updated++;
      } else {
        // ID가 겹치지 않도록 새 ID 부여
        const id = getWordById(w.id) ? makeId() : w.id;
        state.words.push({ ...w, id });
        idMap.set(w.id, id);
        added++;
      }
    });
    mergeLibraries(libraries, idMap);
    mergeHistory(history, idMap);
    showToast(`추가 ${added}개, 갱신 ${updated}개`);
  }
  saveWords();
  saveLibraries();
  saveHistory();
  refreshAllViews();
  if (choice === 'replace') showToast(`단어 ${state.words.length}개를 가져왔습니다.`);
}

/** 같은 단어가 여러 번 있으면 마지막 것만 남김 */
function dedupeWords(words) {
  const map = new Map();
  words.forEach(w => map.set(wordKey(w.word), w));
  return Array.from(map.values());
}

/* ---------- 백업 알림 ---------- */

/** 백업이 필요한지: 단어가 있고, 마지막 백업(없으면 최초 사용) 후 7일 경과 */
function isBackupDue() {
  if (state.words.length === 0) return false;
  const since = state.meta.lastBackup || state.meta.firstUse || Date.now();
  if (Date.now() - since < BACKUP_REMIND_DAYS * DAY_MS) return false;
  // "나중에"를 누르면 하루 동안 다시 묻지 않음
  if (state.meta.snoozeUntil && Date.now() < state.meta.snoozeUntil) return false;
  return true;
}

function updateBackupBanner() {
  const due = isBackupDue();
  $('#backup-banner').hidden = !due;
  if (due) {
    $('#backup-banner-text').textContent = state.meta.lastBackup
      ? `마지막 백업 후 ${Math.floor((Date.now() - state.meta.lastBackup) / DAY_MS)}일이 지났어요. 데이터를 백업해 주세요.`
      : '아직 백업한 적이 없어요. 데이터를 백업해 주세요.';
  }
}

function renderBackupInfo() {
  $('#backup-info').textContent = state.meta.lastBackup
    ? `마지막 백업: ${formatDate(state.meta.lastBackup)}`
    : '아직 백업한 적이 없습니다. 기기를 바꾸거나 앱을 지우면 데이터가 사라지니 주기적으로 백업하세요.';
}

function initBackup() {
  $('#export-btn').addEventListener('click', exportBackup);
  $('#banner-backup-btn').addEventListener('click', exportBackup);
  $('#banner-later-btn').addEventListener('click', () => {
    state.meta.snoozeUntil = Date.now() + DAY_MS;
    saveMeta();
    updateBackupBanner();
  });
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = ''; // 같은 파일을 다시 고를 수 있게 초기화
    if (file) await importBackupFile(file);
  });
  renderBackupInfo();
  updateBackupBanner();
}
