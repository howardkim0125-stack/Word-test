/* ============================================================
 * sw.js — 서비스 워커: 앱 파일을 캐시해서 오프라인에서도 동작
 *  - 파일을 수정해서 다시 배포할 때는 CACHE_VERSION 숫자를 올려 주세요.
 * ============================================================ */

const CACHE_VERSION = 'v3';
const CACHE_NAME = `wordbook-${CACHE_VERSION}`;

// 오프라인에서 필요한 모든 파일 (상대 경로라 GitHub Pages 하위 폴더에서도 동작)
const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/storage.js',
  './js/ui.js',
  './js/speech.js',
  './js/samples.js',
  './js/packs.js',
  './js/dict-data.js',
  './js/dict.js',
  './js/libraries.js',
  './js/words.js',
  './js/review.js',
  './js/history.js',
  './js/recommend.js',
  './js/cards.js',
  './js/stats.js',
  './js/list.js',
  './js/register.js',
  './js/quiz.js',
  './js/backup.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// 설치: 앱 파일 미리 캐시
//  - 이미 쓰던 버전이 있으면 바로 바꾸지 않고 기다림 → 앱에서 "지금 적용"을 누르면 교체
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
});

// 앱에서 "지금 적용"을 누르면 기다리던 새 버전으로 교체
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// 활성화: 예전 버전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('wordbook-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 요청 처리: 캐시 우선, 없으면 네트워크 (받은 파일은 캐시에 추가)
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // 오프라인에서 페이지 이동 요청이면 첫 화면으로
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
