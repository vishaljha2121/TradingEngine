interface ChartLegendItem {
  label: string;
  color: string;
  helper?: string;
}

export function ChartLegend({ items }: { items: ChartLegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <div key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-txt-secondary">{item.label}</span>
          {item.helper && <span className="text-[10px] text-txt-muted">{item.helper}</span>}
        </div>
      ))}
    </div>
  );
}
