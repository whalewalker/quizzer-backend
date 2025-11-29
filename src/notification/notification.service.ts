import { Injectable, Logger } from "@nestjs/common";
import * as admin from "firebase-admin";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private initialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const serviceAccountPath = this.configService.get<string>(
        "FIREBASE_SERVICE_ACCOUNT_PATH"
      );

      if (serviceAccountPath) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.initialized = true;
        this.logger.log("Firebase Admin initialized successfully");
      } else {
        this.logger.warn(
          "FIREBASE_SERVICE_ACCOUNT_PATH not set. Push notifications will be disabled."
        );
      }
    } catch (error) {
      this.logger.error("Failed to initialize Firebase Admin", error);
    }
  }

  async registerToken(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });

    if (!user) return;

    if (!user.fcmTokens.includes(token)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          fcmTokens: {
            push: token,
          },
        },
      });
    }
  }

  async unregisterToken(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });

    if (!user) return;

    const updatedTokens = user.fcmTokens.filter((t) => t !== token);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fcmTokens: updatedTokens,
      },
    });
  }

  async sendNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ) {
    if (!this.initialized) {
      this.logger.warn("Firebase not initialized. Skipping notification.");
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });

    if (!user || user.fcmTokens.length === 0) {
      return;
    }

    const message: admin.messaging.MulticastMessage = {
      tokens: user.fcmTokens,
      notification: {
        title,
        body,
      },
      data,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      // Cleanup invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(user.fcmTokens[idx]);
          }
        });

        if (failedTokens.length > 0) {
          const activeTokens = user.fcmTokens.filter(
            (t) => !failedTokens.includes(t)
          );
          await this.prisma.user.update({
            where: { id: userId },
            data: { fcmTokens: activeTokens },
          });
        }
      }

      this.logger.log(
        `Notification sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failure`
      );
    } catch (error) {
      this.logger.error(`Error sending notification to user ${userId}`, error);
    }
  }
}
