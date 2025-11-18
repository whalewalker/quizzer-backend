/*
  Warnings:

  - A unique constraint covering the columns `[userId,topic]` on the table `recommendations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "recommendations_userId_topic_key" ON "recommendations"("userId", "topic");
