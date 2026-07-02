import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createIncident,
  resolveIncident,
  findRelevantIncident,
} from "../src/modules/dbModules.js";
import { prisma } from "../src/database/prisma.js";

// Мокаем prisma
vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    incident: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe("dbModules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createIncident (Создание инцидента)", () => {
    it("должен создавать новый инцидент, если дубликатов нет", async () => {
      (prisma.incident.findFirst as any).mockResolvedValue(null);
      const mockIncident = {
        id: 1,
        incidentType: "обрыв",
        transportType: "трамвай",
        routes: ["5"],
        location: null,
        direction: null,
      };
      (prisma.incident.create as any).mockResolvedValue(mockIncident);

      const result = await createIncident({
        transportType: "трамвай",
        incidentType: "обрыв",
        routes: ["5"],
      });

      expect(prisma.incident.create).toHaveBeenCalled();
      expect(result).toEqual({ incident: mockIncident, isNew: true });
    });

    it("не должен создавать новый инцидент, если это полный дубликат", async () => {
      const duplicateData = {
        incidentType: "обрыв",
        transportType: "трамвай",
        routes: ["5"],
        location: "Ленина",
        direction: "в центр",
      };
      const existingIncident = { id: 2, status: "active", ...duplicateData };

      (prisma.incident.findFirst as any).mockResolvedValue(existingIncident);

      const result = await createIncident(duplicateData);

      expect(prisma.incident.findFirst).toHaveBeenCalled();
      expect(prisma.incident.create).not.toHaveBeenCalled();
      expect(result).toEqual({ incident: existingIncident, isNew: false });
    });
  });

  describe("resolveIncident (Закрытие инцидента)", () => {
    it("должен закрывать инциденты, обновляя статус", async () => {
      (prisma.incident.updateMany as any).mockResolvedValue({ count: 2 });

      const result = await resolveIncident({
        transportType: "трамвай",
        routes: ["5"],
      });

      expect(prisma.incident.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "resolved" }),
        }),
      );
      expect(result).toEqual({ count: 2 });
    });

    it("должен возвращать { count: 0 } если данные пустые", async () => {
      const result = await resolveIncident({ routes: [], location: null });

      expect(prisma.incident.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual({ count: 0 });
    });

    it("должен закрывать инцидент только для указанного типа транспорта при одинаковых номерах маршрутов", async () => {
      (prisma.incident.updateMany as any).mockResolvedValue({ count: 1 });

      // Пытаемся закрыть 5 троллейбус (при этом 5 трамвай закрыт не должен быть)
      const result = await resolveIncident({
        transportType: "троллейбус",
        routes: ["5"],
      });

      // Проверяем, что запрос к БД содержит строгое указание типа транспорта
      expect(prisma.incident.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "active",
            transportType: "троллейбус",
            OR: expect.arrayContaining([
              expect.objectContaining({
                transportType: "троллейбус",
                routes: { hasSome: ["5"] },
              }),
            ]),
          }),
        }),
      );
      expect(result).toEqual({ count: 1 });
    });
  });

  describe("findRelevantIncident (Запрос пассажира)", () => {
    it("должен находить активные инциденты по маршруту", async () => {
      const mockIncidents = [
        { id: 1, transportType: "трамвай", routes: ["5"] },
      ];
      (prisma.incident.findMany as any).mockResolvedValue(mockIncidents);

      const result = await findRelevantIncident({
        routes: ["5"],
        transportType: "трамвай",
        isDelayQuestion: true,
      });

      expect(prisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "active",
            routes: { hasSome: ["5"] },
            transportType: "трамвай",
          }),
        }),
      );
      expect(result).toEqual(mockIncidents);
    });

    it("должен возвращать пустой массив, если инцидентов нет", async () => {
      (prisma.incident.findMany as any).mockResolvedValue([]);

      const result = await findRelevantIncident({
        routes: ["1"],
        transportType: "троллейбус",
        isDelayQuestion: true,
      });

      expect(prisma.incident.findMany).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
