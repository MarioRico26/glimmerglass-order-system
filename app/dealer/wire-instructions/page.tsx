import Link from 'next/link'
import WireInstructions from '@/components/WireInstructions'

export default function DealerWireInstructionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Wire Instructions</h1>
        <p className="text-slate-600">Use these details for bank transfers and reference your order.</p>
      </div>

      <WireInstructions />

      <div>
        <Link
          href="/dealer/new-order"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Back to New Order
        </Link>
      </div>
    </div>
  )
}
