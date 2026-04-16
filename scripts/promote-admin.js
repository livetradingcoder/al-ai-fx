/**
 * Tool to promote a user to an administrative role in the database.
 * Run via: node scripts/promote-admin.js <email>
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide the email address you wish to promote.");
    console.log("Usage: node scripts/promote-admin.js <email>");
    process.exit(1);
  }

  const emailLower = email.trim().toLowerCase();

  try {
    const user = await prisma.user.update({
      where: { email: emailLower },
      data: { role: "ADMIN" }
    });
    
    console.log(`\n✅ Success! User ${user.email} promoted directly to the ADMIN role.`);
    console.log("They can now access https://your-domain.com/admin");
  } catch (err) {
    if (err.code === 'P2025') { // Prisma error for record not found
      console.error(`\n❌ Error: Could not find any user in the database with the email: ${emailLower}`);
    } else {
      console.error("\n❌ Database error occurred:", err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

run();
