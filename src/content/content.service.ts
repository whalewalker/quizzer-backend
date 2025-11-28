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

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService
  ) {}

  async generateFromTopic(userId: string, topic: string) {
    // Use AI service to generate educational content
    const generatedContent = await this.aiService.generateContent({
      prompt: `Generate comprehensive educational content about: ${topic}. Include key concepts, explanations, and examples.`,
      maxTokens: 2000,
    });

    return this.prisma.content.create({
      data: {
        title: `${topic} - Study Material`,
        content: generatedContent,
        topic,
        userId,
      },
    });
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

  async getContents(userId: string, topic?: string) {
    return this.prisma.content.findMany({
      where: {
        userId,
        ...(topic ? { topic } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });
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
}
