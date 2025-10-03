import { Link, useLocation } from "react-router-dom";
import type { IconType } from "react-icons";
import { FiMenu } from "react-icons/fi";
import { useState } from "react";
import clsx from "clsx";

export type NavItem = {
  to: string;
  label: string;
  icon: IconType;
};

type SidebarNavProps = {
  items: NavItem[];
};

function SidebarNav({ items }: SidebarNavProps) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 rounded-full bg-primary p-3 text-white shadow-lg transition sm:hidden"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="開關選單"
      >
        <FiMenu className="h-5 w-5" />
      </button>
      <nav
        className={clsx(
          "fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 transition-transform sm:static sm:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
      >
        <div className="mb-8 px-2">
          <span className="text-lg font-semibold text-primary">Practice</span>
          <p className="text-xs text-slate-500">每日佛修記錄</p>
        </div>
        <ul className="flex-1 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-2 border-t border-slate-200 bg-white px-2 py-2 sm:hidden">
        {items.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                "flex flex-col items-center rounded-lg px-2 py-1 text-xs",
                active ? "text-primary" : "text-slate-600"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default SidebarNav;
