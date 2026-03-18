'use client'

import { useEffect, useMemo, useState } from 'react'
import { labelDocType, type OrderDocTypeKey } from '@/lib/orderFlow'

type LabelsResponse = {
  labels?: Record<string, string>
}

export function useWorkflowDocLabels() {
  const [labels, setLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const res = await fetch('/api/workflow-doc-labels', { cache: 'no-store' })
        const payload = (await res.json().catch(() => null)) as LabelsResponse | null
        if (!res.ok || !payload?.labels || !active) return
        setLabels(payload.labels)
      } catch {
        // keep defaults
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const labelForDocType = useMemo(
    () => (docType?: string | null) => {
      if (!docType) return null
      return labels[docType] || labelDocType(docType as OrderDocTypeKey)
    },
    [labels]
  )

  return {
    labels,
    labelForDocType,
  }
}
