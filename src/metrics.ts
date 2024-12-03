import {
  TokenMetrics,
  StreamMetrics,
  StreamMetricsOptions,
  MetricsState,
} from "./types";

export class StreamMetricsCollector {
  private readonly options: Required<StreamMetricsOptions>;
  private readonly state: MetricsState;
  private readonly metrics: TokenMetrics[] = [];
  private lastMetricTime: number;

  static readonly DEFAULT_OPTIONS: Required<StreamMetricsOptions> = {
    metricsInterval: 10,
    maxTimeGap: 5000,
    windowSize: 100,
  };

  constructor(options: Partial<StreamMetricsOptions> = {}) {
    this.options = { ...StreamMetricsCollector.DEFAULT_OPTIONS, ...options };
    this.lastMetricTime = Date.now();
    this.state = {
      totalTokens: 0,
      metricPoints: 0,
      totalBytes: 0,
      totalProcessTime: 0,
      averageTokenLength: 0,
      startTime: Date.now(),
      averageTokensPerSecond: 0,
    };
  }

  async processToken(token: string): Promise<StreamMetrics | null> {
    if (!token) return null;

    const startTime = process.hrtime();
    this.updateState(token, startTime);

    if (this.shouldCollectMetrics()) {
      const metrics = this.calculateMetrics();
      this.lastMetricTime = Date.now();
      return metrics;
    }

    return null;
  }

  getMetricsState(): MetricsState {
    const totalTime = (Date.now() - this.state.startTime) / 1000;
    return {
      ...this.state,
      averageTokensPerSecond: this.state.totalTokens / totalTime,
    };
  }

  private updateState(token: string, startTime: [number, number]): void {
    this.state.totalTokens++;
    this.state.totalBytes += token.length;

    const processTime = process.hrtime(startTime)[1] / 1000000;
    this.state.totalProcessTime += processTime;
    this.state.averageTokenLength =
      this.state.totalBytes / this.state.totalTokens;

    this.metrics.push({
      length: token.length,
      processTime,
    });

    if (this.metrics.length > this.options.windowSize) {
      this.metrics.shift();
    }
  }

  private shouldCollectMetrics(): boolean {
    const now = Date.now();
    return (
      now - this.lastMetricTime > this.options.maxTimeGap ||
      this.state.totalTokens % this.options.metricsInterval === 0
    );
  }

  private calculateMetrics(): StreamMetrics {
    const recentMetrics = this.metrics.slice(-this.options.metricsInterval);
    const totalLength = recentMetrics.reduce((sum, m) => sum + m.length, 0);
    const totalProcessTime = recentMetrics.reduce(
      (sum, m) => sum + m.processTime,
      0
    );
    const elapsedSeconds = (Date.now() - this.lastMetricTime) / 1000;

    this.state.metricPoints++;

    return {
      averageTokenLength: totalLength / recentMetrics.length,
      processTimeMs: totalProcessTime,
      totalBytes: totalLength,
      tokensPerSecond: this.options.metricsInterval / elapsedSeconds,
    };
  }
}
