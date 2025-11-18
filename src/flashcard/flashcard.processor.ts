import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GenerateFlashcardDto } from './dto/flashcard.dto';

export interface FlashcardJobData {
  userId: string;
  dto: GenerateFlashcardDto;
  files?: Array<{
    path: string;
    originalname: string;
    mimetype: string;
  }>;
}

@Processor('flashcard-generation')
export class FlashcardProcessor extends WorkerHost {
  private readonly logger = new Logger(FlashcardProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(job: Job<FlashcardJobData>): Promise<any> {
    const { userId, dto, files } = job.data;
    this.logger.log(`Processing flashcard generation job ${job.id} for user ${userId}`);

    try {
      // Update progress
      await job.updateProgress(10);
      this.logger.debug(`Job ${job.id}: Converting file data`);

      // Convert file data back to Multer.File format if files exist
      const multerFiles = files?.map((f) => ({
        path: f.path,
        originalname: f.originalname,
        mimetype: f.mimetype,
      })) as Express.Multer.File[] | undefined;

      await job.updateProgress(20);

      // Generate flashcards using AI
      this.logger.log(`Job ${job.id}: Calling AI service to generate flashcards`);
      const { cards, title, topic } = await this.aiService.generateFlashcards({
        topic: dto.topic,
        content: dto.content,
        files: multerFiles,
        numberOfCards: dto.numberOfCards,
      });

      this.logger.log(`Job ${job.id}: AI generated ${cards.length} flashcards`);
      await job.updateProgress(70);

      // Determine source type
      let sourceType = 'topic';
      if (dto.content) sourceType = 'text';
      if (files && files.length > 0) sourceType = 'file';

      // Save flashcard set to database
      this.logger.debug(`Job ${job.id}: Saving flashcard set to database`);
      const flashcardSet = await this.prisma.flashcardSet.create({
        data: {
          title,
          topic,
          cards: cards as any,
          userId,
          sourceType,
          sourceFiles: files ? files.map((f) => f.originalname) : [],
        },
      });

      await job.updateProgress(100);
      this.logger.log(`Job ${job.id}: Flashcard generation completed successfully (Set ID: ${flashcardSet.id})`);

      return {
        success: true,
        flashcardSet,
      };
    } catch (error) {
      this.logger.error(`Job ${job.id}: Flashcard generation failed`, error);
      throw error;
    }
  }
}
