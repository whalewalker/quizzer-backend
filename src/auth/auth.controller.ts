import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import {
  SignupDto,
  LoginDto,
  AuthResponseDto,
  GoogleAuthDto,
} from "./dto/auth.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @ApiOperation({ summary: "Create a new user account" })
  @ApiResponse({
    status: 201,
    description: "User successfully created",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "User with this email already exists",
  })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post("login")
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("google")
  @ApiOperation({ summary: "Sign in with Google" })
  @ApiResponse({
    status: 200,
    description: "Google login successful",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid Google token" })
  async googleLogin(@Body() googleAuthDto: GoogleAuthDto) {
    return this.authService.googleLogin(googleAuthDto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User profile retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getCurrentUser(@CurrentUser("sub") userId: string) {
    return this.authService.getCurrentUser(userId);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout current user" })
  @ApiResponse({ status: 200, description: "Logged out successfully" })
  async logout() {
    return { message: "Logged out successfully" };
  }
}
