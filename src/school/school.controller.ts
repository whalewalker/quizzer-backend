import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SchoolService } from "./school.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("schools")
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get("search")
  async search(@Query("q") query: string) {
    return this.schoolService.searchSchools(query);
  }
}
