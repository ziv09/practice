declare const self: ServiceWorkerGlobalScope;

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_TEST_NOTIFICATION") {
    void self.registration.showNotification("Practice 提醒", {
      body: "這是測試通知，記得填寫今日功課喔！",
      icon: "/pwa-192x192.png",
      vibrate: [100, 50, 100],
      tag: "practice-test"
    });
  }
});

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
