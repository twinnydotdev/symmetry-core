import { LlamaCppProvider } from "../../src/providers/llamacpp";
import { logger } from "../../src/logger";
import { ProviderConfig } from "../../src/types";

// Mock dependencies
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

describe("LlamaCppProvider", () => {
  let provider: LlamaCppProvider;
  
  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LlamaCppProvider();
  });
  
  test("should have correct server config", () => {
    expect(provider.serverConfig).toMatchObject({
      name: "llamacpp",
      apiPort: 8080,
      apiHealthPath: "/health",
      apiProtocol: "http",
      apiHostname: "localhost",
    });
  });
  
  test("setup should log error if server not detected", async () => {
    // Mock detectServer to return null (server not detected)
    jest.spyOn(provider, "detectServer").mockResolvedValue(null);
    
    await provider.setup();
    
    expect(logger.error).toHaveBeenCalledWith("❌ LlamaCpp server not detected");
  });
  
  test("setup should detect server and get models", async () => {
    // Mock server detection
    const mockServer: Partial<ProviderConfig> = {
      name: "llamacpp",
      apiPort: 8080,
      apiHealthPath: "/health",
    };
    
    jest.spyOn(provider, "detectServer").mockResolvedValue(mockServer);
    
    // Mock getModels to return models
    const mockModels = [
      { id: "llama2", object: "model", created: 123, owned_by: "meta" },
      { id: "mistral", object: "model", created: 456, owned_by: "mistral" },
    ];
    
    jest.spyOn(provider, "getModels").mockResolvedValue(mockModels);
    
    // Mock selectModel to return a model
    jest.spyOn(provider, "selectModel").mockResolvedValue("llama2");
    
    // Mock createConfig
    const createConfigSpy = jest.spyOn(provider as unknown as { 
      createConfig(server: Partial<ProviderConfig>): Promise<void> 
    }, "createConfig").mockResolvedValue();
    
    await provider.setup();
    
    expect(logger.info).toHaveBeenCalledWith("✅ Detected LlamaCpp on port 8080");
    expect(provider.getModels).toHaveBeenCalled();
    expect(provider.selectModel).toHaveBeenCalledWith(mockModels);
    expect(logger.info).toHaveBeenCalledWith("Selected model: llama2");
    
    // Verify createConfig was called with the correct server config
    expect(createConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "llamacpp",
        apiPort: 8080,
        apiHealthPath: "/health",
        modelName: "llama2",
      })
    );
  });
  
  test("setup should handle empty models list", async () => {
    // Mock server detection
    const mockServer: Partial<ProviderConfig> = {
      name: "llamacpp",
      apiPort: 8080,
      apiHealthPath: "/health",
    };
    
    jest.spyOn(provider, "detectServer").mockResolvedValue(mockServer);
    
    // Mock getModels to return empty array
    jest.spyOn(provider, "getModels").mockResolvedValue([]);
    
    // Mock createConfig
    const createConfigSpy = jest.spyOn(provider as unknown as { 
      createConfig(server: Partial<ProviderConfig>): Promise<void> 
    }, "createConfig").mockResolvedValue();
    
    await provider.setup();
    
    expect(logger.info).toHaveBeenCalledWith("✅ Detected LlamaCpp on port 8080");
    expect(provider.getModels).toHaveBeenCalled();
    // We can't check if selectModel was called since it's not a mock
    
    // Verify createConfig was called with the correct server config
    expect(createConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "llamacpp",
        apiPort: 8080,
        apiHealthPath: "/health",
      })
    );
  });
});