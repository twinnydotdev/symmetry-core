import { ProviderConfig  } from "./types";
import fs from "fs";
import yaml from "js-yaml";

export class ConfigManager {
  private config: ProviderConfig;
  private configPath: string

  constructor(configPath: string) {
    const configFile = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(configFile) as ProviderConfig;
    this.configPath = configPath
    this.config = config
    this.validate();
  }

  public getConfigPath () {
    return this.configPath;
  }

  public getAll () {
    return this.config;
  }

  private validate(): void {
    const requiredFields: (keyof ProviderConfig)[] = [
      "apiChatPath",
      "apiHostname",
      "apiPort",
      "apiProtocol",
      "apiProvider",
      "dataPath",
      "modelName",
      "public",
      "serverKey",
    ];

    for (const field of requiredFields) {
      if (!(field in this.config)) {
        throw new Error(
          `Missing required field in client configuration: ${field}`
        );
      }
    }

    if (typeof this.config.public !== "boolean") {
      throw new Error(
        'The "public" field in client configuration must be a boolean'
      );
    }
  }

  get<K extends keyof ProviderConfig>(key: K): ProviderConfig[K];
  get(key: string): unknown {
    return this.config[key as keyof ProviderConfig];
  }
}
