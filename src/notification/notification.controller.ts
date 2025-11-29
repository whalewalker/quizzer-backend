import { Controller, Post, Body, UseGuards, Delete } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { NotificationService } from "./notification.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post("register")
  @ApiOperation({ summary: "Register FCM token" })
  @ApiResponse({ status: 201, description: "Token registered successfully" })
  async registerToken(
    @CurrentUser("sub") userId: string,
    @Body("token") token: string
  ) {
    return this.notificationService.registerToken(userId, token);
  }

  @Delete("unregister")
  @ApiOperation({ summary: "Unregister FCM token" })
  @ApiResponse({ status: 200, description: "Token unregistered successfully" })
  async unregisterToken(
    @CurrentUser("sub") userId: string,
    @Body("token") token: string
  ) {
    return this.notificationService.unregisterToken(userId, token);
  }
}
