import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('attempts')
@UseGuards(JwtAuthGuard)
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Get()
  async getAllAttempts(@CurrentUser('sub') userId: string) {
    return this.attemptService.getAllAttempts(userId);
  }

  @Get(':id')
  async getAttemptById(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.attemptService.getAttemptById(id, userId);
  }
}
