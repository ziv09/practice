import { useEffect, lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/_LoginPage";
import { supabase } from "./lib/supabaseClient";
import { usePracticeStore } from "./store/practiceStore";
import { useAutoSyncLifecycle } from "./hooks/useAutoSyncLifecycle";
import { useJournalSheetSyncLifecycle } from "./hooks/useJournalSheetSyncLifecycle";
import { useSheetSyncLifecycle } from "./hooks/useSheetSyncLifecycle";
import LoadingScreen from "./components/LoadingScreen";
import ErrorBoundary from "./components/ErrorBoundary";

const MainLayout = lazy(() => import("./layout/MainLayout"));
const AuthGate = lazy(() => import("./pages/AuthGate"));
const TodayPage = lazy(() => import("./pages/TodayPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const GoalsPage = lazy(() => import("./pages/GoalsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));

function App() {
  const setUser = usePracticeStore((s) => s.setUser);
  useAutoSyncLifecycle();
  useJournalSheetSyncLifecycle();
    useSheetSyncLifecycle();
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

  const errorFallback = (
    <div className="flex h-full items-center justify-center py-20">
      <div className="text-center text-slate-600">
        <p className="mb-3">發生錯誤，請重新整理。</p>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
          onClick={() => window.location.reload()}
        >
          重新整理
        </button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
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
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
