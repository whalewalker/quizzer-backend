import { Module } from "@nestjs/common";
import { ContentService } from "./content.service";
import { ContentController } from "./content.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
