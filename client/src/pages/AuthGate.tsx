import { useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { usePracticeStore } from "../store/practiceStore";
import { supabase } from "../lib/supabaseClient";

function AuthGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = usePracticeStore((s) => s.userId);
  const setUser = usePracticeStore((s) => s.setUser);

  useEffect(() => {
    const unprotected = ["/login", "/auth/callback"]; // ?è¨±?žå‘¼?‡ç™»?¥é?ä¸å?ä¿è­·
    if (unprotected.includes(location.pathname)) return;
    if (userId) return;
    (async () => {
      if (!supabase) {
        navigate("/login", { replace: true });
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await setUser(data.session.user.id, { forceReload: true });
        return;
      }
      navigate("/login", { replace: true });
    })();
  }, [userId, navigate, location.pathname, setUser]);

  return <Outlet />;
}

export default AuthGate;


