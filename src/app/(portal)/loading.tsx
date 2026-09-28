export default function PortalLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4" role="status" aria-live="polite">
      <p className="text-sm font-medium text-[#5c5654]">Opening this page…</p>
      <div className="h-10 w-56 rounded-xl bg-white" />
      <div className="h-72 rounded-2xl bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]" />
    </div>
  );
}
