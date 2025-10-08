import { Outlet, useLocation } from "react-router-dom";
import {
  FiCalendar,
  FiList,
  FiTarget,
  FiPieChart,
  FiBookOpen,
  FiBell,
  FiSettings
} from "react-icons/fi";
import React from "react";
import SidebarNav from "../components/SidebarNav";
import Toast from "../components/Toast";
import { useInitializeStore } from "../hooks/useInitializeStore";
import LoadingScreen from "../components/LoadingScreen";
import { useAppearanceEffect } from "../hooks/useAppearanceEffect";
import { supabase } from "../lib/supabaseClient";
import { usePracticeStore } from "../store/practiceStore";

const NAV_ITEMS = [
  { to: "/today", label: "今日", icon: FiCalendar },
  { to: "/tasks", label: "功課", icon: FiList },
    { to: "/goals", label: "目標", icon: FiTarget },
  { to: "/dashboard", label: "儀表板", icon: FiPieChart },
  { to: "/journal", label: "記事", icon: FiBookOpen },
  { to: "/reminders", label: "提醒", icon: FiBell },
  { to: "/settings", label: "設定", icon: FiSettings }
];

const TITLE_MAP: Record<string, string> = {
  "/today": "今日功課",
  "/tasks": "功課管理",
  "/records": "紀錄管理",
  "/goals": "目標追蹤",
  "/dashboard": "視覺化面板",
  "/journal": "修行記事",
  "/reminders": "提醒設定",
  "/settings": "系統設定"
};

function MainLayout() {
  const { pathname } = useLocation();
  const ready = useInitializeStore();
  useAppearanceEffect();
  const title = TITLE_MAP[pathname] ?? "Practice";
  const [email, setEmail] = React.useState<string | null>(null);
  React.useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
    })();
  }, []);
  const setUser = usePracticeStore((s) => s.setUser);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <SidebarNav items={NAV_ITEMS} />
      <div className="flex min-h-screen w-full flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600"
                onClick={async () => {
                  if (!supabase) return;
                  await supabase.auth.signOut();
                  await setUser(null);
                }}
              >
                登出
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 sm:px-6">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}

export default MainLayout;
