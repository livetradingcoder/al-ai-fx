/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node scripts/create-admin.js <email> <password>');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'ADMIN',
        passwordHash: hashedPassword
      },
      create: {
        email,
        name: 'Administrator',
        passwordHash: hashedPassword,
        role: 'ADMIN'
      }
    });

    console.log(`Admin user created/updated: ${user.email}`);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
