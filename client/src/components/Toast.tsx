import React from "react";

type ToastItem = { id: string; type: "info" | "error" | "success"; message: string };

function Toast() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string; message: string };
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const type = (detail?.type as ToastItem["type"]) || "info";
      setItems((prev) => [...prev, { id, type, message: detail.message }]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4000);
    };
    window.addEventListener("app-toast", handler as EventListener);
    return () => window.removeEventListener("app-toast", handler as EventListener);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`min-w-[240px] rounded-lg px-3 py-2 text-sm shadow ${
            item.type === "error"
              ? "bg-rose-600 text-white"
              : item.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-white"
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}

export default Toast;

