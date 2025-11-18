import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ChallengeService } from './challenge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('challenges')
@UseGuards(JwtAuthGuard)
export class ChallengeController {
  constructor(private readonly challengeService: ChallengeService) {}

  @Get()
  async getAllChallenges(@CurrentUser('sub') userId: string) {
    return this.challengeService.getAllChallenges(userId);
  }

  @Get('daily')
  async getDailyChallenges(@CurrentUser('sub') userId: string) {
    return this.challengeService.getDailyChallenges(userId);
  }

  @Post('complete')
  async completeChallenge(
    @CurrentUser('sub') userId: string,
    @Body() body: { challengeId: string },
  ) {
    return this.challengeService.completeChallenge(body.challengeId, userId);
  }

  @Post('join')
  async joinChallenge(
    @CurrentUser('sub') userId: string,
    @Body() body: { challengeId: string },
  ) {
    return this.challengeService.joinChallenge(body.challengeId, userId);
  }
}
