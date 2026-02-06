export default function WireInstructions({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={[
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        compact ? 'p-4' : 'p-6',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Wire Instructions</h2>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          Please call to confirm
        </span>
      </div>

      <div className="mt-3 text-sm text-slate-700">
        <div className="font-semibold">M &amp; T Bank</div>
        <div>(609) 242-3590</div>
      </div>

      <div className={compact ? 'mt-4 grid gap-2 text-sm' : 'mt-4 grid gap-3 text-sm'}>
        <Row label="Business Name" value="Kline Brothers East Landscaping East" />
        <Row label="Bank" value="M & T Bank" />
        <Row label="Bank Address" value="Forked River, NJ" />
        <Row label="Routing" value="022000046" />
        <Row label="Account" value="9869438326" />
        <Row label="Reference Format" value="Dealer name + Order ID" />
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Please call to confirm before wiring.
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  )
}
