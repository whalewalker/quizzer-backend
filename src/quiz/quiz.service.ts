import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { StreakService } from '../streak/streak.service';
import { ChallengeService } from '../challenge/challenge.service';
import { GenerateQuizDto, SubmitQuizDto } from './dto/quiz.dto';

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    @InjectQueue('quiz-generation') private readonly quizQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly recommendationService: RecommendationService,
    private readonly streakService: StreakService,
    private readonly challengeService: ChallengeService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async generateQuiz(
    userId: string,
    dto: GenerateQuizDto,
    files?: Express.Multer.File[],
  ) {
    this.logger.log(`User ${userId} requesting quiz generation: ${dto.numberOfQuestions} questions, difficulty: ${dto.difficulty}`);
    
    // Serialize file data for the queue
    const fileData = files?.map((f) => ({
      path: f.path,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));

    // Add job to queue
    const job = await this.quizQueue.add(
      'generate',
      {
        userId,
        dto,
        files: fileData,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`Quiz generation job created with ID: ${job.id}`);
    return {
      jobId: job.id,
      status: 'pending',
    };
  }

  async getJobStatus(jobId: string, userId: string) {
    this.logger.debug(`Checking job status for job ${jobId}, user ${userId}`);
    const job = await this.quizQueue.getJob(jobId);

    if (!job) {
      this.logger.warn(`Job ${jobId} not found`);
      throw new NotFoundException('Job not found');
    }

    // Security: check if job belongs to user
    if (job.data.userId !== userId) {
      this.logger.warn(`User ${userId} attempted to access job ${jobId} owned by ${job.data.userId}`);
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress;

    this.logger.debug(`Job ${jobId} status: ${state}, progress: ${JSON.stringify(progress)}`);

    return {
      jobId: job.id,
      status: state,
      progress,
      result: state === 'completed' ? await job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
    };
  }

  async getAllQuizzes(userId: string) {
    const cacheKey = `quizzes:all:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      this.logger.debug(`Cache hit for all quizzes, user ${userId}`);
      return cached;
    }

    const quizzes = await this.prisma.quiz.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        topic: true,
        difficulty: true,
        createdAt: true,
        questions: true,
      },
    });

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, quizzes, 300000);

    return quizzes;
  }

  async getQuizById(id: string, userId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, userId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Remove sensitive information (correct answers and explanations) from questions
    const sanitizedQuiz = {
      ...quiz,
      questions: (quiz.questions as any[]).map((q) => {
        const { correctAnswer, explanation, ...sanitizedQuestion } = q;
        return sanitizedQuestion;
      }),
    };

    return sanitizedQuiz;
  }

  async submitQuiz(userId: string, quizId: string, dto: SubmitQuizDto) {
    this.logger.log(`User ${userId} submitting quiz ${quizId}`);
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, userId },
    });

    if (!quiz) {
      this.logger.warn(`Quiz ${quizId} not found for user ${userId}`);
      throw new NotFoundException('Quiz not found');
    }

    const questions = quiz.questions as any[];
    let correctCount = 0;

    const correctAnswers = questions.map((q, index) => {
      const isCorrect = this.checkAnswer(q, dto.answers[index]);
      if (isCorrect) correctCount++;
      return q.correctAnswer;
    });

    // Save attempt
    const attempt = await this.prisma.attempt.create({
      data: {
        userId,
        quizId,
        type: 'quiz',
        score: correctCount,
        totalQuestions: questions.length,
        answers: dto.answers as any,
      },
    });

    // Invalidate quiz cache after submission
    await this.cacheManager.del(`quizzes:all:${userId}`);

    // Update streak with score data
    await this.streakService.updateStreak(userId, correctCount, questions.length);

    // Update challenge progress
    const isPerfect = correctCount === questions.length;
    this.challengeService
      .updateChallengeProgress(userId, 'quiz', isPerfect)
      .catch((err) => this.logger.error(`Failed to update challenge progress for user ${userId}:`, err));

    // Generate and store recommendations based on the latest attempt.
    // Fire-and-forget so the API response isn't delayed.
    this.logger.debug(`Triggering recommendation generation for user ${userId}`);
    this.recommendationService
      .generateAndStoreRecommendations(userId)
      .catch((err) => this.logger.error(`Failed to generate recommendations for user ${userId}:`, err));

    this.logger.log(`Quiz ${quizId} submitted: ${correctCount}/${questions.length} correct`);
    return {
      attemptId: attempt.id,
      score: correctCount,
      totalQuestions: questions.length,
      percentage: Math.round((correctCount / questions.length) * 100),
      correctAnswers,
    };
  }

  /**
   * Check if an answer is correct based on question type
   */
  private checkAnswer(question: any, userAnswer: any): boolean {
    const correctAnswer = question.correctAnswer;
    const questionType = question.questionType || 'single-select';

    switch (questionType) {
      case 'true-false':
      case 'single-select':
        return userAnswer === correctAnswer;

      case 'multi-select': {
        if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) return false;
        if (userAnswer.length !== correctAnswer.length) return false;
        const sortedUser = [...userAnswer].sort((a, b) => a - b);
        const sortedCorrect = [...correctAnswer].sort((a, b) => a - b);
        return sortedUser.every((val, idx) => val === sortedCorrect[idx]);
      }

      case 'fill-blank':
        if (typeof userAnswer !== 'string' || typeof correctAnswer !== 'string') return false;
        return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

      case 'matching': {
        if (typeof userAnswer !== 'object' || typeof correctAnswer !== 'object') return false;
        const userKeys = Object.keys(userAnswer || {}).sort((a, b) => a.localeCompare(b));
        const correctKeys = Object.keys(correctAnswer || {}).sort((a, b) => a.localeCompare(b));
        if (userKeys.length !== correctKeys.length) return false;
        return userKeys.every(key => userAnswer[key] === correctAnswer[key]);
      }

      default:
        return userAnswer === correctAnswer;
    }
  }

  async getAttempts(userId: string, quizId?: string) {
    const where: any = { userId, type: 'quiz' };
    if (quizId) {
      where.quizId = quizId;
    }

    return this.prisma.attempt.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            topic: true,
          },
        },
      },
    });
  }
}
