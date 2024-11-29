import { logger } from "../logger";
import { OpenAIModel, ProviderConfig } from "../types";
import { BaseProvider } from "./base";

export class OpenWebUIProvider extends BaseProvider {
  readonly serverConfig: ProviderConfig = {
    ...this.serverConfig,
    name: "openwebui",
    apiProvider: "openwebui",
    apiPort: 8080,
    apiHealthPath: "/api/models",
    apiModelsPath: "/api/models",
  } as ProviderConfig;

  async getModels(): Promise<OpenAIModel[]> {
    try {
      const response = await fetch(
        `${this.serverConfig.apiProtocol}://${this.serverConfig.apiHostname}:${this.serverConfig.apiPort}${this.serverConfig.apiModelsPath}`
      );
      const data = await response.json();
      return data.map((model: OpenAIModel) => ({
        id: model.id,
        object: "model",
        owned_by: "local",
        created: Date.now(),
      }));
    } catch {
      return [];
    }
  }

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
