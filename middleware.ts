import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Middleware para proteger rutas específicas
export default withAuth(
  function middleware(req) {
    // Puedes agregar lógica extra si lo deseas
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Solo permite si hay token (sesión activa)
        return !!token
      },
    },
  }
)

// Define qué rutas deben estar protegidas
export const config = {
  matcher: [
    '/dealer/:path*',
    '/admin/:path*',
    '/superadmin/:path*',
  ],
}