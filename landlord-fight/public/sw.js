/* 满意斗地主 · 离线缓存 Service Worker */
const CACHE = 'manyi-landlord-v3'
const CORE = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  // 真人语音包（预缓存，离线可播报）
  './voice/bid-0.mp3',
  './voice/bid-1.mp3',
  './voice/bid-2.mp3',
  './voice/bid-3.mp3',
  './voice/chat-0.mp3',
  './voice/chat-1.mp3',
  './voice/chat-2.mp3',
  './voice/chat-3.mp3',
  './voice/chat-4.mp3',
  './voice/chat-5.mp3',
  './voice/chat-6.mp3',
  './voice/left-1.mp3',
  './voice/left-2.mp3',
  './voice/lose.mp3',
  './voice/pair-10.mp3',
  './voice/pair-11.mp3',
  './voice/pair-12.mp3',
  './voice/pair-13.mp3',
  './voice/pair-14.mp3',
  './voice/pair-15.mp3',
  './voice/pair-3.mp3',
  './voice/pair-4.mp3',
  './voice/pair-5.mp3',
  './voice/pair-6.mp3',
  './voice/pair-7.mp3',
  './voice/pair-8.mp3',
  './voice/pair-9.mp3',
  './voice/pass-0.mp3',
  './voice/pass-1.mp3',
  './voice/pass-2.mp3',
  './voice/pass-3.mp3',
  './voice/pat-bomb.mp3',
  './voice/pat-plane.mp3',
  './voice/pat-quad.mp3',
  './voice/pat-rocket.mp3',
  './voice/pat-straight.mp3',
  './voice/pat-straight_pair.mp3',
  './voice/pat-triple_pair.mp3',
  './voice/pat-triple_single.mp3',
  './voice/single-10.mp3',
  './voice/single-11.mp3',
  './voice/single-12.mp3',
  './voice/single-13.mp3',
  './voice/single-14.mp3',
  './voice/single-15.mp3',
  './voice/single-16.mp3',
  './voice/single-17.mp3',
  './voice/single-3.mp3',
  './voice/single-4.mp3',
  './voice/single-5.mp3',
  './voice/single-6.mp3',
  './voice/single-7.mp3',
  './voice/single-8.mp3',
  './voice/single-9.mp3',
  './voice/triple-10.mp3',
  './voice/triple-11.mp3',
  './voice/triple-12.mp3',
  './voice/triple-13.mp3',
  './voice/triple-14.mp3',
  './voice/triple-15.mp3',
  './voice/triple-3.mp3',
  './voice/triple-4.mp3',
  './voice/triple-5.mp3',
  './voice/triple-6.mp3',
  './voice/triple-7.mp3',
  './voice/triple-8.mp3',
  './voice/triple-9.mp3',
  './voice/win.mp3',
  // 男声语音包
  './voice-male/bid-0.mp3',
  './voice-male/bid-1.mp3',
  './voice-male/bid-2.mp3',
  './voice-male/bid-3.mp3',
  './voice-male/chat-0.mp3',
  './voice-male/chat-1.mp3',
  './voice-male/chat-2.mp3',
  './voice-male/chat-3.mp3',
  './voice-male/chat-4.mp3',
  './voice-male/chat-5.mp3',
  './voice-male/chat-6.mp3',
  './voice-male/left-1.mp3',
  './voice-male/left-2.mp3',
  './voice-male/lose.mp3',
  './voice-male/pair-10.mp3',
  './voice-male/pair-11.mp3',
  './voice-male/pair-12.mp3',
  './voice-male/pair-13.mp3',
  './voice-male/pair-14.mp3',
  './voice-male/pair-15.mp3',
  './voice-male/pair-3.mp3',
  './voice-male/pair-4.mp3',
  './voice-male/pair-5.mp3',
  './voice-male/pair-6.mp3',
  './voice-male/pair-7.mp3',
  './voice-male/pair-8.mp3',
  './voice-male/pair-9.mp3',
  './voice-male/pass-0.mp3',
  './voice-male/pass-1.mp3',
  './voice-male/pass-2.mp3',
  './voice-male/pass-3.mp3',
  './voice-male/pat-bomb.mp3',
  './voice-male/pat-plane.mp3',
  './voice-male/pat-quad.mp3',
  './voice-male/pat-rocket.mp3',
  './voice-male/pat-straight.mp3',
  './voice-male/pat-straight_pair.mp3',
  './voice-male/pat-triple_pair.mp3',
  './voice-male/pat-triple_single.mp3',
  './voice-male/single-10.mp3',
  './voice-male/single-11.mp3',
  './voice-male/single-12.mp3',
  './voice-male/single-13.mp3',
  './voice-male/single-14.mp3',
  './voice-male/single-15.mp3',
  './voice-male/single-16.mp3',
  './voice-male/single-17.mp3',
  './voice-male/single-3.mp3',
  './voice-male/single-4.mp3',
  './voice-male/single-5.mp3',
  './voice-male/single-6.mp3',
  './voice-male/single-7.mp3',
  './voice-male/single-8.mp3',
  './voice-male/single-9.mp3',
  './voice-male/triple-10.mp3',
  './voice-male/triple-11.mp3',
  './voice-male/triple-12.mp3',
  './voice-male/triple-13.mp3',
  './voice-male/triple-14.mp3',
  './voice-male/triple-15.mp3',
  './voice-male/triple-3.mp3',
  './voice-male/triple-4.mp3',
  './voice-male/triple-5.mp3',
  './voice-male/triple-6.mp3',
  './voice-male/triple-7.mp3',
  './voice-male/triple-8.mp3',
  './voice-male/triple-9.mp3',
  './voice-male/win.mp3',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return

  // 页面导航：网络优先，断网回退缓存
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./').then((r) => r || caches.match('./index.html'))),
    )
    return
  }

  // 静态资源（JS/CSS/图标）：缓存优先，后台补缓存
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return res
        }),
    ),
  )
})
