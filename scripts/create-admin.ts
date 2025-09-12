// scripts/create-admin.ts

import { prisma } from '../lib/prisma'
import bcrypt from 'bcrypt'

async function main() {
  const email = 'admin@test.com'
  const plainPassword = 'admin123'

  // Hashear contraseña
  const hashedPassword = await bcrypt.hash(plainPassword, 10)

  // Crear usuario
  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'ADMIN',
      approved: true,
    },
  })

  console.log('✅ Admin user created:', admin)
}

main()
  .catch((e) => {
    console.error('❌ Error creating admin:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })