-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "quizType" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN     "timeLimit" INTEGER;
