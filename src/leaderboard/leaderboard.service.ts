import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getGlobalLeaderboard() {
    const cacheKey = 'leaderboard:global';
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const entries = await this.prisma.leaderboardEntry.findMany({
      take: 100,
      orderBy: { score: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    const result = {
      entries: entries.map((entry, index) => ({
        userId: entry.userId,
        userName: entry.user.name,
        avatar: entry.user.avatar,
        score: entry.score,
        rank: index + 1,
      })),
    };

    // Cache leaderboard for 1 minute
    await this.cacheManager.set(cacheKey, result, 60000);

    return result;
  }

  async getFriendsLeaderboard(userId: string) {
    // For now, return empty array since we don't have friends functionality
    // In a real app, you'd query based on friendships
    return {
      entries: [],
    };
  }

  async updateUserScore(userId: string, pointsToAdd: number) {
    const existing = await this.prisma.leaderboardEntry.findUnique({
      where: { userId },
    });

    let result;
    if (existing) {
      result = await this.prisma.leaderboardEntry.update({
        where: { userId },
        data: {
          score: existing.score + pointsToAdd,
        },
      });
    } else {
      result = await this.prisma.leaderboardEntry.create({
        data: {
          userId,
          score: pointsToAdd,
        },
      });
    }

    // Invalidate leaderboard cache when scores are updated
    await this.cacheManager.del('leaderboard:global');
    return result;
  }
}
