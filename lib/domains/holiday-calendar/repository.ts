import { prisma } from "@/lib/db";
import type { HolidayCalendarEntryInput } from "./types";

export const holidayCalendarRepository = {
  findByDates(dates: Date[]) {
    return prisma.holidayCalendarDate.findMany({
      where: { date: { in: dates } },
    });
  },

  findSync(year: number) {
    return prisma.holidayCalendarSync.findUnique({
      where: { year_provider: { year, provider: "GOOGLE" } },
    });
  },

  async saveGoogleYear(
    year: number,
    entries: HolidayCalendarEntryInput[],
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const syncedAt = new Date();
      const start = new Date(`${year}-01-01T00:00:00.000Z`);
      const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
      await tx.holidayCalendarDate.deleteMany({
        where: {
          source: "GOOGLE",
          date: { gte: start, lt: end },
        },
      });

      for (const entry of entries) {
        await tx.holidayCalendarDate.upsert({
          where: { date: entry.date },
          update: {
            name: entry.name,
            source: "GOOGLE",
            sourceReference: entry.sourceReference,
            fetchedAt: new Date(),
          },
          create: {
            date: entry.date,
            name: entry.name,
            source: "GOOGLE",
            sourceReference: entry.sourceReference,
          },
        });
      }

      await tx.holidayCalendarSync.upsert({
        where: { year_provider: { year, provider: "GOOGLE" } },
        update: {
          status: "SUCCESS",
          lastAttemptAt: syncedAt,
          lastSuccessAt: syncedAt,
          errorMessage: null,
        },
        create: {
          year,
          provider: "GOOGLE",
          status: "SUCCESS",
          lastAttemptAt: syncedAt,
          lastSuccessAt: syncedAt,
        },
      });
    });
  },

  async recordGoogleFailure(year: number, message: string): Promise<void> {
    await prisma.holidayCalendarSync.upsert({
      where: { year_provider: { year, provider: "GOOGLE" } },
      update: {
        status: "FAILED",
        lastAttemptAt: new Date(),
        errorMessage: message.slice(0, 1000),
      },
      create: {
        year,
        provider: "GOOGLE",
        status: "FAILED",
        lastAttemptAt: new Date(),
        errorMessage: message.slice(0, 1000),
      },
    });
  },
};
