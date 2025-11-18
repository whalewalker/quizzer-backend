import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { DAILY_CHALLENGES } from './daily-challenges';

@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getAllChallenges(userId: string) {
    const cacheKey = `challenges:all:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      this.logger.debug(`Cache hit for all challenges, user ${userId}`);
      return cached;
    }

    const challenges = await this.prisma.challenge.findMany({
      where: {
        endDate: {
          gte: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const challengesWithProgress = await Promise.all(
      challenges.map(async (challenge) => {
        const completion = await this.prisma.challengeCompletion.findUnique({
          where: {
            challengeId_userId: {
              challengeId: challenge.id,
              userId,
            },
          },
        });

        return {
          ...challenge,
          progress: completion?.progress || 0,
          completed: completion?.completed || false,
        };
      }),
    );

    // Cache for 2 minutes
    await this.cacheManager.set(cacheKey, challengesWithProgress, 120000);

    return challengesWithProgress;
  }

  async getDailyChallenges(userId: string) {
    this.logger.debug(`Fetching daily challenges for user ${userId}`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const cacheKey = `challenges:daily:${userId}:${today.toISOString()}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      this.logger.debug(`Cache hit for daily challenges, user ${userId}`);
      return cached;
    }

    // Get or create today's challenges
    let challenges: any[] = await this.prisma.challenge.findMany({
      where: {
        type: 'daily',
        startDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        completions: {
          where: { userId },
        },
      },
    });

    // If no challenges exist for today, create them
    if (challenges.length === 0) {
      this.logger.log('Creating new daily challenges');
      // Pick 3 random daily challenges
      const selectedChallenges = this.getRandomChallenges(DAILY_CHALLENGES, 3);
      
      const createPromises = selectedChallenges.map((template) =>
        this.prisma.challenge.create({
          data: {
            title: template.title,
            description: template.description,
            type: template.type,
            target: template.target,
            reward: template.reward,
            startDate: today,
            endDate: tomorrow,
          },
        }),
      );

      challenges = await Promise.all(createPromises);
      
      // Create completion records for the user
      const completionPromises = challenges.map((challenge) =>
        this.prisma.challengeCompletion.create({
          data: {
            challengeId: challenge.id,
            userId,
            progress: 0,
            completed: false,
          },
        }),
      );
      
      await Promise.all(completionPromises);

      // Refetch with completions
      challenges = await this.prisma.challenge.findMany({
        where: {
          type: 'daily',
          startDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          completions: {
            where: { userId },
          },
        },
      });
    }

    const result = challenges.map((challenge) => ({
      ...challenge,
      userProgress: challenge.completions[0]?.progress || 0,
      completed: challenge.completions[0]?.completed || false,
    }));

    // Cache daily challenges until midnight
    const ttl = tomorrow.getTime() - Date.now();
    await this.cacheManager.set(cacheKey, result, ttl);

    return result;
  }

  async updateChallengeProgress(
    userId: string,
    type: 'quiz' | 'flashcard',
    isPerfect = false,
  ) {
    this.logger.debug(`Updating challenge progress for user ${userId}, type: ${type}`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's challenges with user completions
    const challenges = await this.prisma.challenge.findMany({
      where: {
        type: 'daily',
        startDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        completions: {
          where: { userId },
        },
      },
    });

    const updates = [];

    for (const challenge of challenges) {
      const completion = challenge.completions[0];
      if (!completion || completion.completed) continue;

      const progressUpdate = this.calculateProgressUpdate(challenge, completion, type, isPerfect);
      
      if (progressUpdate.shouldUpdate) {
        const isCompleted = progressUpdate.newProgress >= challenge.target;
        
        updates.push(
          this.prisma.challengeCompletion.update({
            where: { id: completion.id },
            data: {
              progress: Math.min(progressUpdate.newProgress, challenge.target),
              completed: isCompleted,
              completedAt: isCompleted ? new Date() : null,
            },
          }),
        );

        if (isCompleted) {
          // Award XP for challenge completion
          await this.awardChallengeXP(userId, challenge.reward);
          this.logger.log(`User ${userId} completed challenge: ${challenge.title}, reward: ${challenge.reward} XP`);
        }
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      
      // Invalidate cache when progress is updated
      const todayKey = today.toISOString();
      await this.cacheManager.del(`challenges:daily:${userId}:${todayKey}`);
      await this.cacheManager.del(`challenges:all:${userId}`);
    }
  }

  private calculateProgressUpdate(
    challenge: any,
    completion: any,
    type: 'quiz' | 'flashcard',
    isPerfect: boolean,
  ) {
    let shouldUpdate = false;
    let newProgress = completion.progress;
    const desc = challenge.description.toLowerCase();

    if (isPerfect && desc.includes('perfect')) {
      shouldUpdate = true;
      newProgress = challenge.target;
    } else if (desc.includes('streak')) {
      shouldUpdate = true;
      newProgress = 1;
    } else if ((type === 'quiz' && desc.includes('quiz')) || (type === 'flashcard' && desc.includes('flashcard'))) {
      shouldUpdate = true;
      newProgress++;
    }

    return { shouldUpdate, newProgress };
  }

  private async awardChallengeXP(userId: string, xp: number) {
    const streak = await this.prisma.streak.findUnique({
      where: { userId },
    });

    if (streak) {
      const newTotalXP = (streak.totalXP || 0) + xp;
      const newLevel = Math.floor(Math.sqrt(newTotalXP / 100)) + 1;

      await this.prisma.streak.update({
        where: { userId },
        data: {
          totalXP: newTotalXP,
          level: newLevel,
        },
      });
    }
  }

  private getRandomChallenges<T>(challenges: T[], count: number): T[] {
    const shuffled = [...challenges].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async completeChallenge(challengeId: string, userId: string) {
    const completion = await this.prisma.challengeCompletion.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      include: {
        challenge: true,
      },
    });

    if (!completion || completion.completed) {
      throw new Error('Challenge already completed or not found');
    }

    if (completion.progress >= completion.challenge.target) {
      return this.prisma.challengeCompletion.update({
        where: {
          challengeId_userId: {
            challengeId,
            userId,
          },
        },
        data: {
          completed: true,
          completedAt: new Date(),
        },
      });
    }

    throw new Error('Challenge requirements not met');
  }

  async joinChallenge(challengeId: string, userId: string) {
    this.logger.debug(`User ${userId} joining challenge ${challengeId}`);

    // Check if challenge exists
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    // Check if challenge has expired
    if (new Date() > challenge.endDate) {
      throw new Error('Challenge has expired');
    }

    // Check if user has already joined
    const existingCompletion = await this.prisma.challengeCompletion.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
    });

    if (existingCompletion) {
      // User already joined, return the challenge with their progress
      return {
        ...challenge,
        progress: existingCompletion.progress,
        completed: existingCompletion.completed,
        joined: true,
      };
    }

    // Create completion record to mark user as joined
    await this.prisma.challengeCompletion.create({
      data: {
        challengeId,
        userId,
        progress: 0,
        completed: false,
      },
    });

    this.logger.log(`User ${userId} successfully joined challenge ${challengeId}`);

    // Invalidate cache when user joins a challenge
    await this.cacheManager.del(`challenges:all:${userId}`);

    return {
      ...challenge,
      progress: 0,
      completed: false,
      joined: true,
    };
  }
}
