/**
 * wyy备忘录 - Service Worker
 * 离线缓存 + 自动更新
 */

const CACHE_NAME = 'wyy-memo-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
];

// 安装事件 - 预缓存核心资源
self.addEventListener('install', (event) => {
    console.log('🐰 SW 安装中...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 预缓存资源');
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.warn('部分缓存失败:', err);
            });
        }).then(() => {
            return self.skipWaiting(); // 立即激活，不等待旧SW
        })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('🌸 SW 已激活，清理旧缓存');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('🗑️ 删除旧缓存:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // 立即接管所有页面
        })
    );
});

// 请求拦截 - 网络优先（保证最新），离线时回退缓存
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (!url.protocol.startsWith('http')) return;

    // 对于页面导航（HTML），使用网络优先策略，保证总是拿到最新版本
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                // 网络请求成功，更新缓存
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clone);
                });
                return networkResponse;
            }).catch(() => {
                // 离线了，用缓存
                return caches.match(event.request).then((cached) => {
                    return cached || caches.match('./');
                });
            })
        );
        return;
    }

    // 对于其他资源（JS/CSS/图片），缓存优先 + 后台更新
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // 后台静默更新
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            // 缓存未命中，走网络
            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return new Response('', { status: 408 });
            });
        })
    );
});

// 接收更新通知
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
