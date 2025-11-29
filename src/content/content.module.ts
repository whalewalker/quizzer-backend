import { Module } from "@nestjs/common";
import { ContentService } from "./content.service";
import { ContentController } from "./content.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AiModule } from "../ai/ai.module";
import { TaskModule } from "../task/task.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [PrismaModule, AiModule, TaskModule, NotificationModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
