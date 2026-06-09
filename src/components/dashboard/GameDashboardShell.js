export default function GameDashboardShell({ children, compact = false }) {
  return (
    <div className={`mx-auto flex max-w-[1240px] flex-col ${compact ? "gap-md" : "gap-lg"}`}>
      {children}
    </div>
  );
}
