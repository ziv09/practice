import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import AuthGate from "./pages/AuthGate";
import TodayPage from "./pages/TodayPage";
import TasksPage from "./pages/TasksPage";
import GoalsPage from "./pages/GoalsPage";
import DashboardPage from "./pages/DashboardPage";
import JournalPage from "./pages/JournalPage";
import SettingsPage from "./pages/SettingsPage";
import RemindersPage from "./pages/RemindersPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import LoginPage from "./pages/LoginPage";
import { supabase } from "./lib/supabaseClient";
import { usePracticeStore } from "./store/practiceStore";

function App() {
  const setUser = usePracticeStore((s) => s.setUser);
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user.id, { forceReload: true });
      }
      supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user?.id ?? null);
      });
    })();
  }, [setUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGate />}>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

export default App;

