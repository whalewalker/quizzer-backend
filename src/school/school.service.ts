import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  async searchSchools(query: string) {
    if (!query || query.length < 2) {
      return [];
    }

    return this.prisma.school.findMany({
      where: {
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: {
        name: "asc",
      },
    });
  }

  async findOrCreate(name: string) {
    const normalizedName = name.trim();

    const existing = await this.prisma.school.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.school.create({
      data: {
        name: normalizedName,
      },
    });
  }
}
