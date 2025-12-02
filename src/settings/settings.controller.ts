import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../admin/guards/admin.guard";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("public")
  @ApiOperation({ summary: "Get public platform settings" })
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: "Get all platform settings (admin only)" })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: "Update platform settings (admin only)" })
  updateSettings(
    @Body()
    data: {
      allowRegistration?: boolean;
      maintenanceMode?: boolean;
      supportEmail?: string;
    }
  ) {
    return this.settingsService.updateSettings(data);
  }
}
