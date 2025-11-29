import { Injectable, NotFoundException, Logger, Inject } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../prisma/prisma.service";
import { RecommendationService } from "../recommendation/recommendation.service";
import { StreakService } from "../streak/streak.service";
import { ChallengeService } from "../challenge/challenge.service";
import { GenerateFlashcardDto } from "./dto/flashcard.dto";

@Injectable()
export class FlashcardService {
  private readonly logger = new Logger(FlashcardService.name);

  constructor(
    @InjectQueue("flashcard-generation") private readonly flashcardQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly recommendationService: RecommendationService,
    private readonly streakService: StreakService,
    private readonly challengeService: ChallengeService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  async generateFlashcards(
    userId: string,
    dto: GenerateFlashcardDto,
    files?: Express.Multer.File[]
  ) {
    this.logger.log(
      `User ${userId} requesting flashcard generation: ${dto.numberOfCards} cards`
    );

    // Serialize file data for the queue
    const fileData = files?.map((f) => ({
      path: f.path,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));

    // Add job to queue
    const job = await this.flashcardQueue.add(
      "generate",
      {
        userId,
        dto,
        files: fileData,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    // Invalidate flashcard cache after new set is generated
    const cacheKey = `flashcards:all:${userId}`;
    await this.cacheManager.del(cacheKey);

    this.logger.log(`Flashcard generation job created with ID: ${job.id}`);
    return {
      jobId: job.id,
      status: "pending",
    };
  }

  async getJobStatus(jobId: string, userId: string) {
    this.logger.debug(
      `Checking flashcard job status for job ${jobId}, user ${userId}`
    );
    const job = await this.flashcardQueue.getJob(jobId);

    if (!job) {
      this.logger.warn(`Flashcard job ${jobId} not found`);
      throw new NotFoundException("Job not found");
    }

    // Security: check if job belongs to user
    if (job.data.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access flashcard job ${jobId} owned by ${job.data.userId}`
      );
      throw new NotFoundException("Job not found");
    }

    const state = await job.getState();
    const progress = job.progress;

    this.logger.debug(
      `Flashcard job ${jobId} status: ${state}, progress: ${JSON.stringify(progress)}`
    );

    return {
      jobId: job.id,
      status: state,
      progress,
      result: state === "completed" ? await job.returnvalue : null,
      error: state === "failed" ? job.failedReason : null,
    };
  }

  async getAllFlashcardSets(userId: string) {
    const cacheKey = `flashcards:all:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for all flashcard sets, user ${userId}`);
      return cached;
    }

    const flashcardSets = await this.prisma.flashcardSet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        topic: true,
        createdAt: true,
        cards: true,
      },
    });

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, flashcardSets, 300000);

    return flashcardSets;
  }

  async getFlashcardSetById(id: string, userId: string) {
    const flashcardSet = await this.prisma.flashcardSet.findFirst({
      where: { id, userId },
    });

    if (!flashcardSet) {
      throw new NotFoundException("Flashcard set not found");
    }

    return flashcardSet;
  }

  async recordFlashcardSession(
    userId: string,
    flashcardSetId: string,
    cardResponses: Array<{
      cardIndex: number;
      response: "know" | "dont-know" | "skipped";
    }>
  ) {
    this.logger.log(
      `User ${userId} recording flashcard session for set ${flashcardSetId}`
    );
    const flashcardSet = await this.prisma.flashcardSet.findFirst({
      where: { id: flashcardSetId, userId },
    });

    if (!flashcardSet) {
      this.logger.warn(
        `Flashcard set ${flashcardSetId} not found for user ${userId}`
      );
      throw new NotFoundException("Flashcard set not found");
    }

    const cards = flashcardSet.cards as any[];

    // Calculate score based on responses
    // know = +1, dont-know = -1, skipped = 0
    let score = 0;
    for (const response of cardResponses) {
      if (response.response === "know") {
        score += 1;
      } else if (response.response === "dont-know") {
        score -= 1;
      }
      // skipped = 0, no change
    }

    // Save attempt with detailed answers
    const attempt = await this.prisma.attempt.create({
      data: {
        userId,
        flashcardSetId,
        type: "flashcard",
        score,
        totalQuestions: cards.length,
        answers: cardResponses, // Store individual responses
      },
    });

    // Invalidate flashcard cache after session
    await this.cacheManager.del(`flashcards:all:${userId}`);

    // Update streak with positive responses count for XP calculation
    const correctCount = cardResponses.filter(
      (r) => r.response === "know"
    ).length;
    await this.streakService.updateStreak(userId, correctCount, cards.length);

    // Update challenge progress based on cards marked as 'know'
    const isPerfect = correctCount === cards.length;
    this.challengeService
      .updateChallengeProgress(userId, "flashcard", isPerfect)
      .catch((err) =>
        this.logger.error(
          `Failed to update challenge progress for user ${userId}:`,
          err
        )
      );

    // Generate and store recommendations based on this flashcard session.
    // Do not block response — run asynchronously.
    this.logger.debug(
      `Triggering recommendation generation for user ${userId}`
    );
    this.recommendationService
      .generateAndStoreRecommendations(userId)
      .catch((err) =>
        this.logger.error(
          `Failed to generate recommendations for user ${userId}:`,
          err
        )
      );

    this.logger.log(
      `Flashcard session recorded: ${correctCount} correct, score: ${score}`
    );
    return {
      ...attempt,
      correctCount,
      incorrectCount: cardResponses.filter((r) => r.response === "dont-know")
        .length,
      skippedCount: cardResponses.filter((r) => r.response === "skipped")
        .length,
    };
  }

  async deleteFlashcardSet(id: string, userId: string) {
    this.logger.log(`User ${userId} deleting flashcard set ${id}`);

    // Verify ownership
    const flashcardSet = await this.prisma.flashcardSet.findFirst({
      where: { id, userId },
    });

    if (!flashcardSet) {
      this.logger.warn(`Flashcard set ${id} not found for user ${userId}`);
      throw new NotFoundException("Flashcard set not found");
    }

    // Delete associated attempts first
    await this.prisma.attempt.deleteMany({
      where: { flashcardSetId: id },
    });

    // Delete the flashcard set
    await this.prisma.flashcardSet.delete({
      where: { id },
    });

    // Invalidate cache
    await this.cacheManager.del(`flashcards:all:${userId}`);

    this.logger.log(`Flashcard set ${id} deleted successfully`);
    return { success: true, message: "Flashcard set deleted successfully" };
  }
}
