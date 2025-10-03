import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function AuthCallbackPage() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      if (!supabase) {
        navigate("/settings", { replace: true });
        return;
      }
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error(error);
      }
      // 無論成功失敗都導回設定頁
      navigate("/settings", { replace: true });
    })();
  }, [navigate]);
  return <p className="p-4 text-slate-600">處理登入中...</p>;
}

export default AuthCallbackPage;

