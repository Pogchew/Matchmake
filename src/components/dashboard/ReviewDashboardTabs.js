const REVIEW_DASHBOARD_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Compare", value: "compare" },
];

export default function ReviewDashboardTabs({ activeTab, onChange }) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-surface-container-low p-1 md:inline-grid">
      {REVIEW_DASHBOARD_TABS.map((tab) => (
        <button
          className={`rounded-lg px-md py-sm font-label-bold text-label-bold transition-colors ${
            activeTab === tab.value
              ? "bg-surface-container-lowest text-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
          key={tab.value}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
