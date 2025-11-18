import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GenerateQuizDto } from './dto/quiz.dto';

export interface QuizJobData {
  userId: string;
  dto: GenerateQuizDto;
  files?: Array<{
    path: string;
    originalname: string;
    mimetype: string;
  }>;
}

@Processor('quiz-generation')
export class QuizProcessor extends WorkerHost {
  private readonly logger = new Logger(QuizProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(job: Job<QuizJobData>): Promise<any> {
    const { userId, dto, files } = job.data;
    this.logger.log(`Processing quiz generation job ${job.id} for user ${userId}`);

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

      // Generate quiz using AI
      this.logger.log(`Job ${job.id}: Calling AI service to generate quiz`);
      const { questions, title, topic } = await this.aiService.generateQuiz({
        topic: dto.topic,
        content: dto.content,
        files: multerFiles,
        numberOfQuestions: dto.numberOfQuestions,
        difficulty: dto.difficulty,
        quizType: dto.quizType,
        questionTypes: dto.questionTypes,
      });

      this.logger.log(`Job ${job.id}: AI generated ${questions.length} questions`);
      await job.updateProgress(70);

      // Determine source type
      let sourceType = 'topic';
      if (dto.content) sourceType = 'text';
      if (files && files.length > 0) sourceType = 'file';

      // Save quiz to database
      this.logger.debug(`Job ${job.id}: Saving quiz to database`);
      const quiz = await this.prisma.quiz.create({
        data: {
          title,
          topic,
          difficulty: dto.difficulty,
          quizType: dto.quizType || 'standard',
          timeLimit: dto.timeLimit,
          questions: questions as any,
          userId,
          sourceType,
          sourceFiles: files ? files.map((f) => f.originalname) : [],
        },
      });

      await job.updateProgress(100);
      this.logger.log(`Job ${job.id}: Quiz generation completed successfully (Quiz ID: ${quiz.id})`);

      return {
        success: true,
        quiz,
      };
    } catch (error) {
      this.logger.error(`Job ${job.id}: Quiz generation failed`, error);
      throw error;
    }
  }
}
