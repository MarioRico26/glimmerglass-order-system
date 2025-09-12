import { prisma } from '@/lib/prisma'
import { AuditAction, Role } from '@prisma/client'

type LogParams = {
    action: AuditAction
    message: string
    actor?: { id?: string|null; email?: string|null; role?: Role|null }
    dealerId?: string|null
    orderId?: string|null
    meta?: Record<string, any> | null
}

/** Log rápido y seguro (no rompe el flujo si falla). */
export async function auditLog({
                                   action, message, actor, dealerId, orderId, meta
                               }: LogParams) {
    try {
        await prisma.auditLog.create({
            data: {
                action,
                message,
                actorUserId: actor?.id || null,
                actorEmail:  actor?.email || null,
                actorRole:   actor?.role || null,
                dealerId:    dealerId || null,
                orderId:     orderId || null,
                meta:        meta as any || undefined,
            },
        })
    } catch (e) {
        console.error('auditLog error:', e) // no lanzamos
    }
}