import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "./guards/admin.guard";
import {
  UserFilterDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  ContentFilterDto,
} from "./dto/admin.dto";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get system statistics" })
  getSystemStats() {
    return this.adminService.getSystemStats();
  }

  @Get("users")
  @ApiOperation({ summary: "Get all users with filtering" })
  getUsers(@Query() filterDto: UserFilterDto) {
    return this.adminService.getUsers(filterDto);
  }

  @Get("users/:id")
  @ApiOperation({ summary: "Get user details" })
  getUserDetails(@Param("id") id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch("users/:id/status")
  @ApiOperation({ summary: "Update user status (active/suspended)" })
  updateUserStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateUserStatusDto
  ) {
    return this.adminService.updateUserStatus(id, updateStatusDto);
  }

  @Patch("users/:id/role")
  @ApiOperation({ summary: "Update user role" })
  updateUserRole(
    @Param("id") id: string,
    @Body() updateRoleDto: UpdateUserRoleDto
  ) {
    return this.adminService.updateUserRole(id, updateRoleDto);
  }

  @Delete("users/:id")
  @ApiOperation({ summary: "Delete user" })
  deleteUser(@Param("id") id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get("content")
  @ApiOperation({ summary: "Get all content (quizzes)" })
  getAllContent(@Query() filterDto: ContentFilterDto) {
    return this.adminService.getAllContent(filterDto);
  }
}
