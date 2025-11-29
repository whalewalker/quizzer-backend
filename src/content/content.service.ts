import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import {
  CreateContentDto,
  CreateHighlightDto,
  UpdateContentDto,
} from "./dto/content.dto";
import { TaskService } from "../task/task.service";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly taskService: TaskService,
    private readonly notificationService: NotificationService
  ) {}

  async generateFromTopic(userId: string, topic: string) {
    const task = await this.taskService.createTask(
      userId,
      "CONTENT_GENERATION"
    );

    // Run in background
    this.generateContentInBackground(userId, topic, task.id);

    return { taskId: task.id };
  }

  private async generateContentInBackground(
    userId: string,
    topic: string,
    taskId: string
  ) {
    try {
      const generatedContent = await this.aiService.generateContent({
        prompt: `Generate comprehensive educational content about: ${topic}. Include key concepts, explanations, and examples.`,
        maxTokens: 2000,
      });

      const content = await this.prisma.content.create({
        data: {
          title: `${topic} - Study Material`,
          content: generatedContent,
          topic,
          userId,
        },
      });

      await this.taskService.updateTask(taskId, "COMPLETED", {
        contentId: content.id,
      });

      await this.notificationService.sendNotification(
        userId,
        "Content Generated",
        `Your study material for "${topic}" is ready!`,
        { contentId: content.id, type: "CONTENT_GENERATION" }
      );
    } catch (error) {
      await this.taskService.updateTask(taskId, "FAILED", null, error.message);

      await this.notificationService.sendNotification(
        userId,
        "Generation Failed",
        `We couldn't generate content for "${topic}". Please try again.`,
        { type: "CONTENT_GENERATION_ERROR" }
      );
    }
  }

  async createFromFile(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Check file type
    const allowedTypes = [
      "text/plain",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Invalid file type. Only PDF, DOCX, and TXT files are allowed."
      );
    }

    // Extract text from file (simplified - in production, use proper PDF/DOCX parsers)
    let extractedText = "";
    if (file.mimetype === "text/plain") {
      extractedText = file.buffer.toString("utf-8");
    } else {
      // For PDF/DOCX, you would use libraries like pdf-parse or mammoth
      extractedText = `Content extracted from ${file.originalname}`;
    }

    // Determine topic using AI
    const topic = await this.aiService.generateContent({
      prompt: `Based on this text, provide a single concise topic name (max 3 words): ${extractedText.substring(0, 500)}`,
      maxTokens: 20,
    });

    return this.prisma.content.create({
      data: {
        title: file.originalname.replace(/\.[^/.]+$/, ""),
        content: extractedText,
        topic: topic.trim(),
        userId,
      },
    });
  }

  async createContent(userId: string, createContentDto: CreateContentDto) {
    return this.prisma.content.create({
      data: {
        ...createContentDto,
        userId,
      },
    });
  }

  async getContents(
    userId: string,
    topic?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.content.findMany({
        where: {
          userId,
          ...(topic ? { topic } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      this.prisma.content.count({
        where: {
          userId,
          ...(topic ? { topic } : {}),
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContentById(userId: string, contentId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: {
        highlights: true,
      },
    });

    if (!content || content.userId !== userId) {
      throw new NotFoundException("Content not found");
    }

    return content;
  }

  async updateContent(
    userId: string,
    contentId: string,
    updateContentDto: UpdateContentDto
  ) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content || content.userId !== userId) {
      throw new NotFoundException("Content not found");
    }

    return this.prisma.content.update({
      where: { id: contentId },
      data: updateContentDto,
    });
  }

  async deleteContent(userId: string, contentId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content || content.userId !== userId) {
      throw new NotFoundException("Content not found");
    }

    return this.prisma.content.delete({
      where: { id: contentId },
    });
  }

  async addHighlight(
    userId: string,
    contentId: string,
    createHighlightDto: CreateHighlightDto
  ) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content || content.userId !== userId) {
      throw new NotFoundException("Content not found");
    }

    return this.prisma.highlight.create({
      data: {
        ...createHighlightDto,
        contentId,
        userId,
      },
    });
  }

  async deleteHighlight(userId: string, highlightId: string) {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
    });

    if (!highlight || highlight.userId !== userId) {
      throw new NotFoundException("Highlight not found");
    }

    return this.prisma.highlight.delete({
      where: { id: highlightId },
    });
  }
  async getPopularTopics() {
    const topics = await this.prisma.content.groupBy({
      by: ["topic"],
      _count: {
        topic: true,
      },
      orderBy: {
        _count: {
          topic: "desc",
        },
      },
      take: 10,
    });

    return topics.map((t) => t.topic);
  }
}
