import React from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  widthClass?: string;
};

export default function Modal({ open, onClose, title, children, widthClass = "max-w-md" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative w-full ${widthClass} rounded-2xl bg-white p-4 shadow-xl sm:p-6`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
