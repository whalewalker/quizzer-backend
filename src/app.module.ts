import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { CacheModule } from "./cache/cache.module";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { QuizModule } from "./quiz/quiz.module";
import { FlashcardModule } from "./flashcard/flashcard.module";
import { StreakModule } from "./streak/streak.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";
import { ChallengeModule } from "./challenge/challenge.module";
import { RecommendationModule } from "./recommendation/recommendation.module";
import { AttemptModule } from "./attempt/attempt.module";
import { ContentModule } from "./content/content.module";
import { StatisticsModule } from "./statistics/statistics.module";
import { UserModule } from "./user/user.module";
import { TaskModule } from "./task/task.module";
import { NotificationModule } from "./notification/notification.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    PrismaModule,
    CacheModule,
    AiModule,
    AuthModule,
    QuizModule,
    FlashcardModule,
    StreakModule,
    LeaderboardModule,
    ChallengeModule,
    RecommendationModule,
    AttemptModule,
    ContentModule,
    StatisticsModule,
    UserModule,
    TaskModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
