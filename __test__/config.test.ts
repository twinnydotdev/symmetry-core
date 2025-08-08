import { ConfigManager } from "../src/config";
import fs from "fs";
import yaml from "js-yaml";

jest.mock("fs", () => ({
  readFileSync: jest.fn(),
}));

jest.mock("js-yaml", () => ({
  load: jest.fn(),
}));

describe("ConfigManager", () => {
  const mockConfigPath = "mock-config.yaml";
  const mockConfig = {
    apiBasePath: "/v1",
    apiHostname: "test.api.com",
    apiPort: 443,
    apiProtocol: "https",
    modelName: "test-model",
    serverKey: "test-server-key",
    name: "test",
    systemMessage: "test-system-message",
    userSecret: "test-secret",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue("mock-yaml-content");
    (yaml.load as jest.Mock).mockReturnValue(mockConfig);
  });

  test("constructor should read and parse config file", () => {
    const configManager = new ConfigManager(mockConfigPath);
    
    expect(fs.readFileSync).toHaveBeenCalledWith(mockConfigPath, "utf8");
    expect(yaml.load).toHaveBeenCalledWith("mock-yaml-content");
    expect(configManager.getAll()).toEqual(mockConfig);
  });

  test("getConfigPath should return the config path", () => {
    const configManager = new ConfigManager(mockConfigPath);
    
    expect(configManager.getConfigPath()).toBe(mockConfigPath);
  });

  test("getAll should return the entire config object", () => {
    const configManager = new ConfigManager(mockConfigPath);
    
    expect(configManager.getAll()).toEqual(mockConfig);
  });

  test("get should return the value for a specific key", () => {
    const configManager = new ConfigManager(mockConfigPath);
    
    expect(configManager.get("apiHostname")).toBe("test.api.com");
    expect(configManager.get("apiPort")).toBe(443);
    expect(configManager.get("modelName")).toBe("test-model");
  });

  test("validate should throw error if required field is missing", () => {
    const incompleteConfig = { ...mockConfig } as Partial<typeof mockConfig>;
    delete incompleteConfig.apiHostname;
    
    (yaml.load as jest.Mock).mockReturnValue(incompleteConfig);
    
    expect(() => new ConfigManager(mockConfigPath)).toThrow(
      "Missing required field in client configuration: apiHostname"
    );
  });
});