import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Deleting generic challenges...");

  // Delete challenges that match the generic titles
  const result = await prisma.challenge.deleteMany({
    where: {
      OR: [
        { title: "Perfect Score" },
        { title: "Quiz Master" },
        { title: "Morning Learner" },
        { title: "Weekend Warrior" }, // Add other potential generic titles if known
        { description: { contains: "Complete 3 quizzes today" } },
        { description: { contains: "Complete 1 quiz today" } },
      ],
    },
  });

  console.log(`Deleted ${result.count} generic challenges.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
