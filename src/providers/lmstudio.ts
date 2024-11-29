import { logger } from "../logger";
import { ProviderConfig } from "../types";
import { BaseProvider } from "./base";

export class LMStudioProvider extends BaseProvider {
  readonly serverConfig: ProviderConfig = {
    ...this.serverConfig,
    name: "lmstudio",
    apiProvider: "lmstudio",
    apiPort: 1234,
    apiHealthPath: "/api/v0/models",
  } as ProviderConfig;

  async detectServer(): Promise<ProviderConfig | null> {
    try {
      const isPortOpen = await this.checkPort(this.serverConfig.apiPort);
      if (!isPortOpen) return null;

      const response = await fetch(
        `${this.serverConfig.apiProtocol}://${this.serverConfig.apiHostname}:${this.serverConfig.apiPort}${this.serverConfig.apiHealthPath}`
      );
      if (!response.ok) return null;

      const models = await this.getModels();

      return models ? this.serverConfig : null;
    } catch {
      return null;
    }
  }

  async setup(): Promise<void> {
    const server = await this.detectServer();
    if (!server) {
      logger.error("❌ LM Studio server not detected");
      return;
    }

    logger.info(`✅ Detected LM Studio on port ${server.apiPort}`);
    const models = await this.getModels();
    if (models.length > 0) {
      server.modelName = await this.selectModel(models);
      logger.info(`Selected model: ${server.modelName}`);
    }

    await this.createConfig(server);
  }
}