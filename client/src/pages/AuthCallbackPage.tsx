import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { usePracticeStore } from "../store/practiceStore";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const setUser = usePracticeStore((s) => s.setUser);
  useEffect(() => {
    (async () => {
      if (!supabase) {
        navigate("/login", { replace: true });
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error(error);
      const user = data.session?.user;
      if (user) {
        await setUser(user.id, { forceReload: true });
        navigate("/today", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);
  return <p className="p-4 text-slate-600">處理登入中...</p>;
}

export default AuthCallbackPage;

