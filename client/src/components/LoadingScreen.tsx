function LoadingScreen() {
  return (
    <div className="flex h-full items-center justify-center py-20">
      <div className="flex items-center gap-3 text-slate-500">
        <span className="h-3 w-3 animate-ping rounded-full bg-primary"></span>
        <span>資料載入中...</span>
      </div>
    </div>
  );
}

export default LoadingScreen;
