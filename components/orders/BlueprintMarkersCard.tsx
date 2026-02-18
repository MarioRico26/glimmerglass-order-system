'use client'

import Link from 'next/link'

export type BlueprintMarkerType = 'skimmer' | 'return' | 'drain'

export type BlueprintMarker = {
  type: BlueprintMarkerType
  x: number
  y: number
}

type Props = {
  title?: string
  subtitle?: string
  blueprintUrl?: string | null
  markers?: BlueprintMarker[] | null
  emptyMessage?: string
}

const TYPE_STYLES: Record<BlueprintMarkerType, { dot: string; chip: string; label: string }> = {
  skimmer: {
    dot: 'bg-sky-600 border-sky-900',
    chip: 'bg-sky-50 text-sky-800 border-sky-200',
    label: 'Skimmer',
  },
  return: {
    dot: 'bg-emerald-600 border-emerald-900',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    label: 'Return',
  },
  drain: {
    dot: 'bg-amber-600 border-amber-900',
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    label: 'Main Drain',
  },
}

function isPdf(url: string | null | undefined) {
  if (!url) return false
  return url.toLowerCase().split('?')[0].endsWith('.pdf')
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export default function BlueprintMarkersCard({
  title = 'Blueprint Markers',
  subtitle = 'Skimmer / return / drain positions captured on order creation.',
  blueprintUrl,
  markers,
  emptyMessage = 'No markers were saved for this order.',
}: Props) {
  const safeMarkers = (markers ?? []).filter(
    (m) => Number.isFinite(m.x) && Number.isFinite(m.y) && TYPE_STYLES[m.type]
  )
  const hasMarkers = safeMarkers.length > 0
  const hasImageBlueprint = !!blueprintUrl && !isPdf(blueprintUrl)

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</div>
        <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
      </div>

      {!hasMarkers ? (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <>
          {hasImageBlueprint ? (
            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white mb-3">
              <img
                src={blueprintUrl!}
                alt="Pool blueprint with markers"
                className="block w-full max-h-[460px] object-contain bg-slate-100"
              />

              {safeMarkers.map((m, idx) => (
                <div
                  key={`${m.type}-${idx}`}
                  className={[
                    'absolute -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 shadow',
                    TYPE_STYLES[m.type].dot,
                  ].join(' ')}
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  title={`${TYPE_STYLES[m.type].label} (${round2(m.x)}%, ${round2(m.y)}%)`}
                />
              ))}
            </div>
          ) : null}

          {blueprintUrl && isPdf(blueprintUrl) ? (
            <div className="mb-3 text-xs text-slate-600">
              Blueprint is a PDF.
              {' '}
              <Link
                href={blueprintUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 hover:underline font-semibold"
              >
                Open blueprint
              </Link>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {safeMarkers.map((m, idx) => (
              <span
                key={`${m.type}-${idx}-chip`}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                  TYPE_STYLES[m.type].chip,
                ].join(' ')}
              >
                <span className="font-black">{TYPE_STYLES[m.type].label}</span>
                <span className="text-[11px] opacity-80">
                  ({round2(m.x)}%, {round2(m.y)}%)
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
