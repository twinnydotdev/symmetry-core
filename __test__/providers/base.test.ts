import { BaseProvider } from "../../src/providers/base";
import { OpenAIModel, ProviderConfig } from "../../src/types";
import fs from "fs/promises";
import yaml from "js-yaml";
import { logger } from "../../src/logger";

// Create a concrete implementation of the abstract class for testing
class TestProvider extends BaseProvider {
  async setup(): Promise<void> {
    // Implementation for testing
  }
}

// Mock dependencies
jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("js-yaml", () => ({
  dump: jest.fn().mockReturnValue("mocked yaml"),
}));

jest.mock("../../src/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe("BaseProvider", () => {
  let provider: TestProvider;
  
  beforeEach(() => {
    jest.clearAllMocks();
    provider = new TestProvider();
    
    // Mock fetch response for getModels
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          { id: "model1", object: "model", created: 123, owned_by: "owner1" },
          { id: "model2", object: "model", created: 456, owned_by: "owner2" },
        ],
      }),
    });
  });
  
  test("should have default server config", () => {
    expect(provider.serverConfig).toMatchObject({
      apiProtocol: "http",
      apiHostname: "localhost",
      apiModelsPath: "/v1/models",
      apiBasePath: "/v1",
      systemMessage: expect.any(String),
      serverKey: expect.any(String),
      userSecret: expect.any(String),
    });
  });
  
  test("getModels should fetch and return models", async () => {
    const models = await provider.getModels();
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/models"),
      { headers: {} }
    );
    
    expect(models).toEqual([
      { id: "model1", object: "model", created: 123, owned_by: "owner1" },
      { id: "model2", object: "model", created: 456, owned_by: "owner2" },
    ]);
  });
  
  test("getModels should include API key in headers if provided", async () => {
    await provider.getModels("test-api-key");
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      { headers: { Authorization: "Bearer test-api-key" } }
    );
  });
  
  test("getModels should handle fetch errors", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
    
    const models = await provider.getModels();
    
    expect(logger.error).toHaveBeenCalledWith("Failed to fetch models");
    expect(models).toEqual([]);
  });
  
  test("getModels should handle non-OK responses", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });
    
    const models = await provider.getModels();
    
    expect(logger.error).toHaveBeenCalledWith("Failed to fetch models");
    expect(models).toEqual([]);
  });
  
  test("createConfig should create directories and write config file", async () => {
    const serverConfig: Partial<ProviderConfig> = {
      name: "test-provider",
      apiPort: 8080,
      apiBasePath: "/v1",
      modelName: "test-model",
    };
    
    await (provider as unknown as { createConfig(server: Partial<ProviderConfig>): Promise<void> })
      .createConfig(serverConfig);
    
    expect(fs.mkdir).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("provider.yaml"),
      "mocked yaml",
      "utf-8"
    );
    
    expect(yaml.dump).toHaveBeenCalledWith(expect.objectContaining({
      name: "symmetry-test-provider",
      apiPort: 8080,
      apiBasePath: "/v1",
      modelName: "test-model",
    }));
  });
  
  test("createConfig should handle errors", async () => {
    (fs.mkdir as jest.Mock).mockRejectedValue(new Error("Permission denied"));
    
    await expect((provider as unknown as { createConfig(server: Partial<ProviderConfig>): Promise<void> })
      .createConfig({})).rejects.toThrow("Permission denied");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to create config file"));
  });
  
  test("detectServer should return null if port is not open", async () => {
    // Mock checkPort to return false
    jest.spyOn(provider as unknown as { checkPort(port?: number): Promise<boolean> },
      "checkPort").mockResolvedValue(false);
    
    const result = await provider.detectServer();
    
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  
  test("detectServer should return server config if server is detected", async () => {
    // Mock checkPort to return true
    jest.spyOn(provider as unknown as { checkPort(port?: number): Promise<boolean> },
      "checkPort").mockResolvedValue(true);
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    });
    
    const result = await provider.detectServer();
    
    expect(result).toEqual(provider.serverConfig);
    expect(global.fetch).toHaveBeenCalled();
  });
  
  test("detectServer should return null if fetch fails", async () => {
    // Mock checkPort to return true
    jest.spyOn(provider as unknown as { checkPort(port?: number): Promise<boolean> },
      "checkPort").mockResolvedValue(true);
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
    
    const result = await provider.detectServer();
    
    expect(result).toBeNull();
  });
  
  test("selectModel should return selected model ID", async () => {
    const models: OpenAIModel[] = [
      { id: "model1", object: "model", created: 123, owned_by: "owner1" },
      { id: "model2", object: "model", created: 456, owned_by: "owner2" },
    ];
    
    // Mock promptUser to return "1" (first model)
    jest.spyOn(BaseProvider as unknown as { promptUser(question: string): Promise<string> },
      "promptUser").mockResolvedValue("1");
    
    const result = await provider.selectModel(models);
    
    expect(result).toBe("model1");
  });
  
  test("selectModel should handle empty models array", async () => {
    const result = await provider.selectModel([]);
    
    expect(result).toBe("");
  });
  
  test("selectModel should handle invalid selection", async () => {
    const models: OpenAIModel[] = [
      { id: "model1", object: "model", created: 123, owned_by: "owner1" },
    ];
    
    // Mock promptUser to return an invalid selection
    jest.spyOn(BaseProvider as unknown as { promptUser(question: string): Promise<string> },
      "promptUser").mockResolvedValue("999");
    
    const result = await provider.selectModel(models);
    
    expect(result).toBe("gpt-3.5-turbo");
  });
});