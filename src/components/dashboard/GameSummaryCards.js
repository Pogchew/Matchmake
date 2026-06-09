export default function GameSummaryCards({ cards = [], limit, stats = {}, title = "Your Team Stats" }) {
  const visibleCards = limit ? cards.slice(0, limit) : cards;

  return (
    <section>
      <div className="mb-sm flex items-center gap-sm">
        <span className="h-3 w-3 rounded-full bg-primary" />
        <h2 className="font-headline-3 text-headline-3 text-on-surface">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
        {visibleCards.map((card) => (
          <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-md" key={card.key}>
            <p className="font-label-small text-label-small text-on-surface-variant">{card.label}</p>
            <p className="mt-xs font-headline-2 text-headline-2 text-primary">{stats?.[card.key] ?? "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
