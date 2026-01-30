import { describe, expect, test } from "bun:test";
import {
  QualityMetricsSchema,
  PerformanceMetricsSchema,
  ReliabilityMetricsSchema,
  WeightedComparisonSchema,
} from "../schemas/comparisons.ts";

describe("Comparison Schemas", () => {
  describe("QualityMetricsSchema", () => {
    test("validates basic quality metrics without confidence intervals", () => {
      const data = {
        avgScore: 0.85,
        passRate: 0.8,
        passCount: 8,
        failCount: 2,
      };

      const result = QualityMetricsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test("validates quality metrics with confidence intervals", () => {
      const data = {
        avgScore: 0.85,
        passRate: 0.8,
        passCount: 8,
        failCount: 2,
        confidenceIntervals: {
          avgScore: [0.8, 0.9],
          passRate: [0.75, 0.85],
        },
      };

      const parsed = QualityMetricsSchema.parse(data);
      expect(parsed.confidenceIntervals?.avgScore).toEqual([0.8, 0.9]);
      expect(parsed.confidenceIntervals?.passRate).toEqual([0.75, 0.85]);
    });

    test("validates quality metrics with partial confidence intervals", () => {
      const data = {
        avgScore: 0.85,
        passRate: 0.8,
        passCount: 8,
        failCount: 2,
        confidenceIntervals: {
          avgScore: [0.8, 0.9],
        },
      };

      const result = QualityMetricsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test("rejects invalid confidence interval format", () => {
      const data = {
        avgScore: 0.85,
        passRate: 0.8,
        passCount: 8,
        failCount: 2,
        confidenceIntervals: {
          avgScore: [0.8], // Should be tuple of 2 numbers
        },
      };

      const result = QualityMetricsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("PerformanceMetricsSchema", () => {
    test("validates basic performance metrics without confidence intervals", () => {
      const data = {
        latency: {
          p50: 1000,
          p90: 2000,
          p99: 3000,
          mean: 1200,
          min: 500,
          max: 4000,
        },
        totalDuration: 120000,
      };

      const result = PerformanceMetricsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test("validates performance metrics with latency confidence intervals", () => {
      const data = {
        latency: {
          p50: 1000,
          p90: 2000,
          p99: 3000,
          mean: 1200,
          min: 500,
          max: 4000,
        },
        totalDuration: 120000,
        confidenceIntervals: {
          latencyMean: [1100, 1300],
        },
      };

      const parsed = PerformanceMetricsSchema.parse(data);
      expect(parsed.confidenceIntervals?.latencyMean).toEqual([1100, 1300]);
    });
  });

  describe("ReliabilityMetricsSchema", () => {
    test("validates run reliability metrics with type discriminator", () => {
      const data = {
        type: "run" as const,
        toolErrors: 0,
        toolErrorRate: 0,
        timeouts: 0,
        timeoutRate: 0,
        completionRate: 1,
      };

      const result = ReliabilityMetricsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test("validates trial reliability metrics with type discriminator", () => {
      const data = {
        type: "trial" as const,
        avgPassExpK: 0.95,
        medianPassExpK: 0.96,
        p25PassExpK: 0.92,
        p75PassExpK: 0.98,
      };

      const result = ReliabilityMetricsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test("rejects run reliability metrics without type discriminator", () => {
      const data = {
        toolErrors: 0,
        toolErrorRate: 0,
        timeouts: 0,
        timeoutRate: 0,
        completionRate: 1,
        // Missing required 'type' field
      };

      const result = ReliabilityMetricsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    test("rejects incomplete reliability metrics", () => {
      const data = {
        type: "run" as const,
        toolErrors: 0,
        // Missing other required fields
      };

      const result = ReliabilityMetricsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("WeightedComparisonSchema integration", () => {
    test("validates full comparison with confidence intervals", () => {
      const data = {
        meta: {
          generatedAt: "2026-01-30T00:00:00Z",
          runs: ["agent-a", "agent-b"],
          promptCount: 10,
        },
        quality: {
          "agent-a": {
            avgScore: 0.85,
            passRate: 0.8,
            passCount: 8,
            failCount: 2,
            confidenceIntervals: {
              avgScore: [0.8, 0.9],
              passRate: [0.75, 0.85],
            },
          },
        },
        performance: {
          "agent-a": {
            latency: {
              p50: 1000,
              p90: 2000,
              p99: 3000,
              mean: 1200,
              min: 500,
              max: 4000,
            },
            totalDuration: 120000,
            confidenceIntervals: {
              latencyMean: [1100, 1300],
            },
          },
        },
        reliability: {
          "agent-a": {
            type: "run",
            toolErrors: 0,
            toolErrorRate: 0,
            timeouts: 0,
            timeoutRate: 0,
            completionRate: 1,
          },
        },
      };

      const result = WeightedComparisonSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
