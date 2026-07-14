import { useCallback, useMemo, useRef, useState } from 'react';
import type { QualityLevel } from '../globe/quality';
import { calculateFrameStats, type FrameStats } from './frameStats';

type BenchmarkPhase = 'disabled' | 'warming' | 'sampling' | 'complete';

export interface BenchmarkResult extends FrameStats {
  capturedAt: string;
  quality: QualityLevel;
  viewport: string;
  devicePixelRatio: number;
}

interface BenchmarkConfig {
  enabled: boolean;
  warmupMs: number;
  durationMs: number;
}

declare global {
  interface Window {
    __MUNDUS_BENCHMARK__?: BenchmarkResult;
  }
}

export function useFrameBenchmark(quality: QualityLevel) {
  const config = useMemo(() => readBenchmarkConfig(), []);
  const [phase, setPhase] = useState<BenchmarkPhase>(
    config.enabled ? 'warming' : 'disabled',
  );
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const startTime = useRef<number | undefined>(undefined);
  const sampleStart = useRef<number | undefined>(undefined);
  const timestamps = useRef<number[]>([]);

  const recordFrame = useCallback(
    (timestamp: number) => {
      if (!config.enabled || result) return;
      startTime.current ??= timestamp;

      if (timestamp - startTime.current < config.warmupMs) return;
      if (sampleStart.current === undefined) {
        sampleStart.current = timestamp;
        timestamps.current = [timestamp];
        setPhase('sampling');
        return;
      }

      timestamps.current.push(timestamp);
      if (timestamp - sampleStart.current < config.durationMs) return;

      const stats = calculateFrameStats(timestamps.current);
      if (!stats) return;
      const completed: BenchmarkResult = {
        ...stats,
        capturedAt: new Date().toISOString(),
        quality,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio,
      };
      window.__MUNDUS_BENCHMARK__ = completed;
      setResult(completed);
      setPhase('complete');
    },
    [config, quality, result],
  );

  return {
    enabled: config.enabled,
    active: config.enabled && phase !== 'complete',
    phase,
    result,
    recordFrame,
  };
}

function readBenchmarkConfig(): BenchmarkConfig {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('benchmark') === '1';
  return {
    enabled,
    warmupMs: readDuration(params.get('benchmarkWarmup'), 2000),
    durationMs: readDuration(params.get('benchmarkDuration'), 10000),
  };
}

function readDuration(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 100 ? parsed : fallback;
}
