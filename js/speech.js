/* ============================================================
 * speech.js — 발음 듣기 (Web Speech API, en-US)
 * ============================================================ */

let englishVoice = null;

/** 사용 가능한 목소리 중 en-US 목소리 고르기 (목록은 비동기로 로드됨) */
function pickEnglishVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  englishVoice =
    voices.find(v => v.lang === 'en-US' && /Samantha|Google US English/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang && v.lang.replace('_', '-').startsWith('en-US')) ||
    null;
}

function initSpeech() {
  if (!('speechSynthesis' in window)) return;
  pickEnglishVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickEnglishVoice);
}

/** 영어 문장/단어 읽어 주기 */
function speak(text) {
  if (!('speechSynthesis' in window)) {
    showToast('이 브라우저는 음성 읽기를 지원하지 않습니다.');
    return;
  }
  speechSynthesis.cancel(); // 이전 발음이 남아 있으면 중단
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (englishVoice) u.voice = englishVoice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

/** 설정에서 '자동 발음'을 켰을 때만 읽어 주기 (지원하지 않으면 조용히 넘어감) */
function autoSpeak(text) {
  if (!state.settings.autoSpeak || !text || !('speechSynthesis' in window)) return;
  speak(text);
}
