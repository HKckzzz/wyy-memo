/**
 * 可爱备忘录 - Service Worker
 * 提供离线缓存和 PWA 功能
 */

const CACHE_NAME = 'cute-memo-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
];

// 安装事件 - 预缓存核心资源
self.addEventListener('install', (event) => {
    console.log('🐰 Service Worker 安装中...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 缓存核心资源');
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.warn('部分资源缓存失败:', err);
            });
        }).then(() => {
            // 强制激活，不等待旧 SW
            return self.skipWaiting();
        })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('🌸 Service Worker 已激活');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ 清理旧缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 立即接管所有页面
            return self.clients.claim();
        })
    );
});

// 请求拦截 - 缓存优先策略
self.addEventListener('fetch', (event) => {
    // 只处理 GET 请求
    if (event.request.method !== 'GET') return;

    // 跳过非 http/https 请求（如 chrome-extension://）
    const url = new URL(event.request.url);
    if (!url.protocol.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // 缓存命中，返回缓存
            if (cachedResponse) {
                // 后台更新缓存（Stale-While-Revalidate）
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(() => {
                    // 网络请求失败，静默处理
                });
                return cachedResponse;
            }

            // 缓存未命中，发起网络请求
            return fetch(event.request).then((networkResponse) => {
                // 缓存成功的响应
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // 离线时返回一个简单的离线页面
                if (event.request.mode === 'navigate') {
                    return new Response(
                        `<!DOCTYPE html>
                        <html lang="zh-CN">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>离线中 - 可爱备忘录</title>
                            <style>
                                body {
                                    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
                                    background: #FFF8F0;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    min-height: 100vh;
                                    margin: 0;
                                    text-align: center;
                                }
                                .offline-box {
                                    padding: 40px;
                                }
                                .offline-emoji {
                                    font-size: 80px;
                                    display: block;
                                    animation: float 2s ease-in-out infinite;
                                }
                                @keyframes float {
                                    0%,100% { transform: translateY(0); }
                                    50% { transform: translateY(-15px); }
                                }
                                h1 { color: #5D4E37; margin-top: 16px; }
                                p { color: #8B7E6B; }
                            </style>
                        </head>
                        <body>
                            <div class="offline-box">
                                <span class="offline-emoji">📡</span>
                                <h1>哎呀，离线了~</h1>
                                <p>请检查网络连接后重试 💕</p>
                            </div>
                        </body>
                        </html>`,
                        {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }
                    );
                }
                // 其他资源的离线回退
                return new Response('', { status: 408 });
            });
        })
    );
});

// 接收消息
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
