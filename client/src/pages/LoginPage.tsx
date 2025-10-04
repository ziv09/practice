import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { usePracticeStore } from "../store/practiceStore";

function LoginPage() {
  const navigate = useNavigate();
  const setUser = usePracticeStore((s) => s.setUser);
  const userId = usePracticeStore((s) => s.userId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 已登入時自動導向 /today
  useEffect(() => {
    (async () => {
      if (userId) {
        navigate("/today", { replace: true });
        return;
      }
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await setUser(data.session.user.id, { forceReload: true });
        navigate("/today", { replace: true });
      }
    })();
  }, [userId, navigate, setUser]);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setMessage("尚未設定 Supabase，請先在設定頁完成環境變數");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        await setUser(data.user.id, { forceReload: true });
        navigate("/today", { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignUp() {
    if (!supabase) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await setUser(data.user.id, { forceReload: true });
        navigate("/today", { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" }
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-4 text-center text-xl font-semibold text-slate-800">登入 Practice</h1>
        {message && <div className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{message}</div>}
        <form className="space-y-3" onSubmit={handleEmailSignIn}>
          <div>
            <label className="block text-xs text-slate-500">Email</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">密碼</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "登入中..." : "Email 登入"}
          </button>
        </form>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">還沒有帳號？</span>
          <button type="button" className="text-primary" onClick={handleEmailSignUp} disabled={loading}>
            建立帳號
          </button>
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary"
            onClick={handleGoogle}
          >
            使用 Google 登入
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
