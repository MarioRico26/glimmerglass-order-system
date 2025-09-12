// scripts/create-superadmin.cjs
const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Uso: node scripts/create-superadmin.cjs <email> <password>')
    process.exit(1)
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    console.log('Usuario ya existe. Nada que hacer.')
    return
  }

  const hashed = await hash(password, 10)

  await prisma.user.create({
    data: {
      email,
      password: hashed,
      role: 'SUPERADMIN',
      approved: true,
    },
  })

  console.log('SUPERADMIN creado:', email)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})