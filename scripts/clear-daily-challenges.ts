import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(
    `Deleting daily challenges between ${today.toISOString()} and ${tomorrow.toISOString()}`
  );

  const deleteResult = await prisma.challenge.deleteMany({
    where: {
      type: "daily",
      startDate: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  console.log(`Deleted ${deleteResult.count} challenges.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
