import { Controller, Get, Put, Delete, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

@ApiTags("User")
@Controller("user")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("profile")
  @ApiOperation({ summary: "Get user profile with statistics" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async getProfile(@CurrentUser("sub") userId: string) {
    return this.userService.getProfile(userId);
  }

  @Put("profile")
  @ApiOperation({ summary: "Update user profile" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async updateProfile(
    @CurrentUser("sub") userId: string,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.userService.updateProfile(userId, updateProfileDto);
  }

  @Put("settings")
  @ApiOperation({ summary: "Update user settings and preferences" })
  @ApiResponse({ status: 200, description: "Settings updated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async updateSettings(
    @CurrentUser("sub") userId: string,
    @Body() updateSettingsDto: UpdateSettingsDto
  ) {
    return this.userService.updateSettings(userId, updateSettingsDto);
  }

  @Put("password")
  @ApiOperation({ summary: "Change user password" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({ status: 401, description: "Current password is incorrect" })
  @ApiResponse({ status: 404, description: "User not found" })
  async changePassword(
    @CurrentUser("sub") userId: string,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.userService.changePassword(userId, changePasswordDto);
  }

  @Delete("account")
  @ApiOperation({ summary: "Delete user account" })
  @ApiResponse({ status: 200, description: "Account deleted successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async deleteAccount(@CurrentUser("sub") userId: string) {
    return this.userService.deleteAccount(userId);
  }
}
