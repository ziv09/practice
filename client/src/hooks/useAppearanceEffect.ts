import { useEffect } from "react";
import { usePracticeStore } from "../store/practiceStore";

export function useAppearanceEffect() {
  const appearance = usePracticeStore((state) => state.settings.appearance);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-color", appearance.accentColor);
    root.style.setProperty("--font-scale", appearance.fontScale.toString());
    root.style.setProperty("font-size", `${appearance.fontScale * 100}%`);
    if (appearance.theme === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", appearance.theme);
    }
  }, [appearance]);
}
