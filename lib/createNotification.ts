import { prisma } from '@/lib/prisma'

type CreateNotificationInput = {
  dealerId: string
  title: string
  message: string
  orderId?: string // opcional para no romper si la columna no existe aún
}

/**
 * Crea una notificación. NO lanza error (loggea y continúa) para no romper flujos críticos.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const data: any = {
      dealerId: input.dealerId,
      title: input.title,
      message: input.message,
    }
    if (input.orderId) {
      data.orderId = input.orderId
    }

    await prisma.notification.create({ data })
  } catch (err: any) {
    // No rompemos el flujo si la notificación falla (p.ej. columna orderId no existe en DB)
    console.warn('createNotification failed, continuing:', err?.code || err?.message || err)
  }
}