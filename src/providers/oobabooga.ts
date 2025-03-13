import { logger } from "../logger";
import { ProviderConfig } from "../types";
import { BaseProvider } from "./base";

export class OobaboogaProvider extends BaseProvider {
  readonly serverConfig: ProviderConfig = {
    ...this.serverConfig,
    name: "oobabooga",
    apiPort: 5000,
    apiHealthPath: "/v1/models",
    apiModelsPath: "/v1/models",
  } as ProviderConfig;

  async setup(): Promise<void> {
    const server = await this.detectServer();
    if (!server) {
      logger.error("❌ OpenWebUI server not detected");
      return;
    }

    logger.info(`✅ Detected OpenWebUI on port ${server.apiPort}`);
    const models = await this.getModels();
    if (models.length > 0) {
      server.modelName = await this.selectModel(models);
      logger.info(`Selected model: ${server.modelName}`);
    }

    await this.createConfig(server);
  }
}
