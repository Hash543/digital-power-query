// Simple block diagram: stages left → right; a stage with several blocks fans out.

export type Block = { label: string; sub?: string; tone?: "source" | "conv" | "load" | "digital" };
export type Stage = Block[];

const toneCls: Record<NonNullable<Block["tone"]>, string> = {
  source: "border-line bg-panel",
  conv: "border-accent/50 bg-accent/10",
  load: "border-line bg-surface",
  digital: "border-amber-500/60 bg-amber-500/10",
};

function Box({ b }: { b: Block }) {
  return (
    <div className={`rounded-md border px-2.5 py-1.5 text-center text-xs leading-tight ${toneCls[b.tone ?? "conv"]}`}>
      <div className="font-medium">{b.label}</div>
      {b.sub && <div className="mt-0.5 font-mono text-[10px] text-muted">{b.sub}</div>}
    </div>
  );
}

export function Flow({ stages, label }: { stages: Stage[]; label: string }) {
  return (
    <div className="overflow-x-auto" role="img" aria-label={label}>
      <div className="flex min-w-max items-center gap-1.5 py-1">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-muted">
                →
              </span>
            )}
            <div className="flex flex-col gap-1.5">
              {stage.map((b, j) => (
                <Box key={j} b={b} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
