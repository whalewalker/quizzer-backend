/*
  Warnings:

  - The `quizType` column on the `quizzes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[contentId]` on the table `flashcard_sets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[contentId]` on the table `quizzes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "QuizType" AS ENUM ('STANDARD', 'QUICK_CHECK', 'TIMED_TEST', 'SCENARIO_BASED', 'CONFIDENCE_BASED');

-- CreateEnum
CREATE TYPE "RetentionLevel" AS ENUM ('LEARNING', 'REINFORCEMENT', 'RECALL', 'MASTERY');

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "confidenceRatings" JSONB,
ADD COLUMN     "timeSpent" INTEGER;

-- AlterTable
ALTER TABLE "contents" ADD COLUMN     "flashcardSetId" TEXT,
ADD COLUMN     "learningGuide" JSONB,
ADD COLUMN     "quizId" TEXT;

-- AlterTable
ALTER TABLE "flashcard_sets" ADD COLUMN     "contentId" TEXT;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "contentId" TEXT,
DROP COLUMN "quizType",
ADD COLUMN     "quizType" "QuizType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fcmTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "retentionLevel" "RetentionLevel" NOT NULL DEFAULT 'LEARNING',
    "strength" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizType" "QuizType" NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weak_areas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "errorCount" INTEGER NOT NULL DEFAULT 1,
    "lastErrorAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weak_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "itemsStudied" INTEGER NOT NULL,
    "performance" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "topic_progress_userId_idx" ON "topic_progress"("userId");

-- CreateIndex
CREATE INDEX "topic_progress_nextReviewAt_idx" ON "topic_progress"("nextReviewAt");

-- CreateIndex
CREATE INDEX "topic_progress_retentionLevel_idx" ON "topic_progress"("retentionLevel");

-- CreateIndex
CREATE UNIQUE INDEX "topic_progress_userId_topic_key" ON "topic_progress"("userId", "topic");

-- CreateIndex
CREATE INDEX "quiz_recommendations_userId_idx" ON "quiz_recommendations"("userId");

-- CreateIndex
CREATE INDEX "quiz_recommendations_completed_idx" ON "quiz_recommendations"("completed");

-- CreateIndex
CREATE INDEX "quiz_recommendations_scheduledFor_idx" ON "quiz_recommendations"("scheduledFor");

-- CreateIndex
CREATE INDEX "quiz_recommendations_priority_idx" ON "quiz_recommendations"("priority");

-- CreateIndex
CREATE INDEX "weak_areas_userId_idx" ON "weak_areas"("userId");

-- CreateIndex
CREATE INDEX "weak_areas_resolved_idx" ON "weak_areas"("resolved");

-- CreateIndex
CREATE INDEX "weak_areas_topic_idx" ON "weak_areas"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "weak_areas_userId_topic_concept_key" ON "weak_areas"("userId", "topic", "concept");

-- CreateIndex
CREATE INDEX "study_sessions_userId_idx" ON "study_sessions"("userId");

-- CreateIndex
CREATE INDEX "study_sessions_startedAt_idx" ON "study_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "study_sessions_type_idx" ON "study_sessions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "flashcard_sets_contentId_key" ON "flashcard_sets"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_contentId_key" ON "quizzes"("contentId");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
