import fs from "fs/promises";
import path from "path";
import net from "net";
import os from "os";
import crypto from "node:crypto";
import yaml from "js-yaml";
import readline from "readline";

import { OpenAIModel, OpenAIModelResponse, ProviderConfig } from "../types";
import { logger } from "../logger";

export abstract class BaseProvider {
  static readonly DEFAULT_CONFIG_PATH = path.join(
    os.homedir(),
    ".config",
    "symmetry"
  );

  serverConfig: Partial<ProviderConfig> = {
    apiProtocol: "http",
    apiHostname: "localhost",
    apiModelsPath: "/v1/models",
    apiBasePath: "/v1",
    systemMessage: "You are a helpful AI assistant.",
    serverKey: crypto.randomBytes(32).toString("hex"),
    userSecret: crypto.randomBytes(16).toString("hex"),
  };

  protected static async promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  protected async checkPort(port?: number): Promise<boolean> {
    if (!port) return false;
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const onError = () => {
        socket.destroy();
        resolve(false);
      };
      socket.setTimeout(1000);
      socket.once("error", onError);
      socket.once("timeout", onError);
      socket.connect(port, "localhost", () => {
        socket.end();
        resolve(true);
      });
    });
  }

  public async getModels(apiKey?: string): Promise<OpenAIModel[]> {
    const path = `${this.serverConfig.apiProtocol}://${this.serverConfig.apiHostname}:${this.serverConfig.apiPort}${this.serverConfig.apiModelsPath}`;
    try {
      const response = await fetch(path, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!response.ok)
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      const data = (await response.json()) as OpenAIModelResponse;
      return data.data;
    } catch (error) {
      logger.error("Failed to fetch models");
      return [];
    }
  }

  protected async createConfig(server: Partial<ProviderConfig>): Promise<void> {
    const configDir = path.join(BaseProvider.DEFAULT_CONFIG_PATH);
    const dataDir = path.join(configDir, "data");
    const config = this.generateConfig(server);

    try {
      await fs.mkdir(configDir, { recursive: true });
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "provider.yaml"),
        yaml.dump(config),
        "utf-8"
      );
    } catch (error) {
      logger.error(
        `Failed to create config file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  private generateConfig(server: Partial<ProviderConfig>) {
    return {
      name: `symmetry-${server.name}`,
      public: true,
      maxConnections: 10,
      apiHostname: "localhost",
      apiPort: server.apiPort,
      apiProtocol: "http",
      apiBasePath: server.apiBasePath,
      modelName: server.modelName,
      systemMessage: "You are a helpful AI assistant.",
      serverKey:
        "4b4a9cc325d134dee6679e9407420023531fd7e96c563f6c5d00fd5549b77435",
      userSecret: crypto.randomBytes(16).toString("hex"),
    };
  }

  public async selectModel(models: OpenAIModel[]): Promise<string> {
    if (models.length === 0) return "";

    console.log("\nAvailable models:");
    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.id}`);
    });

    const selection = await BaseProvider.promptUser(
      "\nSelect a model (enter number): "
    );
    const index = parseInt(selection) - 1;

    if (index >= 0 && index < models.length) {
      return models[index].id;
    }

    return "gpt-3.5-turbo";
  }

  async detectServer(): Promise<Partial<ProviderConfig> | null> {
    try {
      const isPortOpen = await this.checkPort(this.serverConfig.apiPort);
      if (!isPortOpen) return null;

      const response = await fetch(
        `${this.serverConfig.apiProtocol}://${this.serverConfig.apiHostname}:${this.serverConfig.apiPort}${this.serverConfig.apiHealthPath}`
      );

      return response.ok ? this.serverConfig : null;
    } catch {
      return null;
    }
  }

  abstract setup(): Promise<void>;
}
