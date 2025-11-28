import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ContentService } from "./content.service";
import {
  CreateContentDto,
  CreateHighlightDto,
  UpdateContentDto,
} from "./dto/content.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Content")
@Controller("content")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post("generate")
  @ApiOperation({ summary: "Generate content from topic using AI" })
  @ApiResponse({ status: 201, description: "Content generated successfully" })
  async generateFromTopic(
    @CurrentUser("sub") userId: string,
    @Body() body: { topic: string }
  ) {
    return this.contentService.generateFromTopic(userId, body.topic);
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload and process file to create content" })
  @ApiResponse({
    status: 201,
    description: "File uploaded and processed successfully",
  })
  async uploadFile(
    @CurrentUser("sub") userId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.contentService.createFromFile(userId, file);
  }

  @Post()
  @ApiOperation({ summary: "Create new content" })
  @ApiResponse({ status: 201, description: "Content created successfully" })
  async createContent(
    @CurrentUser("sub") userId: string,
    @Body() createContentDto: CreateContentDto
  ) {
    return this.contentService.createContent(userId, createContentDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all content for user" })
  @ApiQuery({ name: "topic", required: false, description: "Filter by topic" })
  @ApiResponse({ status: 200, description: "List of contents" })
  async getContents(
    @CurrentUser("sub") userId: string,
    @Query("topic") topic?: string
  ) {
    return this.contentService.getContents(userId, topic);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get content by ID" })
  @ApiResponse({ status: 200, description: "Content details" })
  @ApiResponse({ status: 404, description: "Content not found" })
  async getContentById(
    @CurrentUser("sub") userId: string,
    @Param("id") contentId: string
  ) {
    return this.contentService.getContentById(userId, contentId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update content" })
  @ApiResponse({ status: 200, description: "Content updated successfully" })
  async updateContent(
    @CurrentUser("sub") userId: string,
    @Param("id") contentId: string,
    @Body() updateContentDto: UpdateContentDto
  ) {
    return this.contentService.updateContent(
      userId,
      contentId,
      updateContentDto
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete content" })
  @ApiResponse({ status: 200, description: "Content deleted successfully" })
  async deleteContent(
    @CurrentUser("sub") userId: string,
    @Param("id") contentId: string
  ) {
    return this.contentService.deleteContent(userId, contentId);
  }

  @Post(":id/highlights")
  @ApiOperation({ summary: "Add highlight to content" })
  @ApiResponse({ status: 201, description: "Highlight added successfully" })
  async addHighlight(
    @CurrentUser("sub") userId: string,
    @Param("id") contentId: string,
    @Body() createHighlightDto: CreateHighlightDto
  ) {
    return this.contentService.addHighlight(
      userId,
      contentId,
      createHighlightDto
    );
  }

  @Delete("highlights/:id")
  @ApiOperation({ summary: "Delete highlight" })
  @ApiResponse({ status: 200, description: "Highlight deleted successfully" })
  async deleteHighlight(
    @CurrentUser("sub") userId: string,
    @Param("id") highlightId: string
  ) {
    return this.contentService.deleteHighlight(userId, highlightId);
  }
}
