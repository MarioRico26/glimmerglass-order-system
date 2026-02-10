export default function ShippingNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={[
        'rounded-xl border border-amber-200 bg-amber-50 text-amber-900',
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
      ].join(' ')}
      role="note"
      aria-label="Shipping notice"
    >
      If shipping is required sooner than 4 weeks, call Glimmerglass Customer Service at 518-993-3333.
    </div>
  )
}
