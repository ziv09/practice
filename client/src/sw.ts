/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

// 預先快取（由 VitePWA injectManifest 注入）
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_TEST_NOTIFICATION") {
    void self.registration.showNotification("Practice 提醒", {
      body: "這是本機測試通知，記得更新今日紀錄",
      icon: "/pwa-192x192.png",
      vibrate: [100, 50, 100],
      tag: "practice-test"
    });
  }
});

self.addEventListener("push", (event) => {
  try {
    const data = event.data?.json() ?? {};
    const title = data.title ?? "Practice 提醒";
    const body = data.body ?? "記錄完成今日練習吧！";
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/pwa-192x192.png",
        tag: "practice-push"
      })
    );
  } catch {}
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/today"));
});

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

