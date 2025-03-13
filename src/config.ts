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
      "apiBasePath",
      "apiHostname",
      "apiPort",
      "apiProtocol",
      "dataPath",
      "modelName",
      "serverKey",
    ];

    for (const field of requiredFields) {
      if (!(field in this.config)) {
        throw new Error(
          `Missing required field in client configuration: ${field}`
        );
      }
    }
  }

  get<K extends keyof ProviderConfig>(key: K): ProviderConfig[K];
  get(key: string): unknown {
    return this.config[key as keyof ProviderConfig];
  }
}
