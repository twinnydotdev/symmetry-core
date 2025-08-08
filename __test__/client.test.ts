import { SymmetryClient } from "../src/client";
import { ConfigManager } from "../src/config";
import { ConnectionManager } from "../src/connection-manager";
import crypto from "hypercore-crypto";
import fs from "fs";
import Hyperswarm from "hyperswarm";

jest.mock("../src/config", () => ({
  ConfigManager: jest.fn(),
}));

jest.mock("../src/connection-manager", () => ({
  ConnectionManager: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("hyperswarm", () => {
  return jest.fn().mockImplementation(() => ({
    join: jest.fn().mockReturnValue({ flushed: jest.fn().mockResolvedValue(undefined) }),
    on: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn(),
  }));
});

jest.mock("hypercore-crypto", () => ({
  discoveryKey: jest.fn().mockReturnValue(Buffer.from("test-discovery-key")),
  keyPair: jest.fn().mockReturnValue({
    publicKey: Buffer.from("test-public-key"),
    secretKey: Buffer.from("test-secret-key"),
  }),
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue("test-random-bytes"),
  }),
}));

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue("{}"),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
  readFileSync: jest.fn().mockReturnValue("{}"),
}));

jest.mock("js-yaml", () => ({
  load: jest.fn(),
  dump: jest.fn().mockReturnValue("mocked yaml"),
}));

jest.mock("fluency.js", () => {
  const mockStreamResult = {
    [Symbol.asyncIterator]: jest.fn().mockImplementation(() => {
      return {
        next: jest.fn()
          .mockResolvedValueOnce({ value: { choices: [{ delta: { content: "Hello" } }] }, done: false })
          .mockResolvedValueOnce({ value: { choices: [{ delta: { content: " world" } }] }, done: false })
          .mockResolvedValueOnce({ done: true }),
      };
    }),
  };

  return {
    FluencyJs: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockStreamResult),
        },
      },
    })),
    TokenJS: jest.fn(),
  };
});

jest.mock("../src/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("SymmetryClient", () => {
  let client: SymmetryClient;
  const mockConfigPath = "mock-config.yaml";
  
  // Define mock config properties
  const mockConfigProps = {
    apiBasePath: "/v1",
    apiHostname: "test.api.com",
    apiPort: 443,
    apiProtocol: "https",
    apiKey: "test-api-key",
    modelName: "test-model",
    name: "test",
    serverKey: "test-server-key",
    systemMessage: "test-system-message",
    userSecret: "test-secret",
  };
  
  // Create mock config with methods
  const mockConfig = {
    ...mockConfigProps,
    get: jest.fn().mockImplementation((key: string) => mockConfigProps[key as keyof typeof mockConfigProps]),
    getAll: jest.fn().mockReturnValue(mockConfigProps),
    getConfigPath: jest.fn().mockReturnValue(mockConfigPath),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ConfigManager as jest.Mock).mockReturnValue(mockConfig);
    client = new SymmetryClient(mockConfigPath);
  });

  test("constructor should initialize with config", () => {
    expect(ConfigManager).toHaveBeenCalledWith(mockConfigPath);
  });

  test("init should set up the client", async () => {
    await client.init();

    expect(Hyperswarm).toHaveBeenCalled();
    
    expect(crypto.discoveryKey).toHaveBeenCalled();
    
    expect(ConnectionManager).toHaveBeenCalledWith({
      onConnection: expect.any(Function),
      serverKey: expect.any(Buffer),
      swarmOptions: expect.objectContaining({
        keyPair: expect.any(Object),
      }),
      onDisconnection: expect.any(Function),
    });
    
    const connectionManager = (ConnectionManager as jest.Mock).mock.results[0].value;
    expect(connectionManager.connect).toHaveBeenCalled();
  });

  test("getOrCreateUserSecret should return existing secret if available", async () => {
    mockConfig.get.mockReturnValueOnce("existing-secret");
    
    const result = await client.getOrCreateUserSecret();
    
    expect(result).toBe("existing-secret");
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
  });

  test("getOrCreateUserSecret should create new secret if not available", async () => {
    mockConfig.get.mockReturnValueOnce(undefined);
    
    (crypto.randomBytes as jest.Mock).mockReturnValueOnce({
      toString: jest.fn().mockReturnValue("test-random-bytes")
    });
    
    const result = await client.getOrCreateUserSecret();
    
    expect(result).toBe("test-random-bytes");
  });

  test("getProviderBaseUrl should construct URL correctly", () => {
    mockConfig.get.mockImplementation((key) => {
      switch (key) {
        case "apiProtocol": return "https";
        case "apiHostname": return "test.api.com";
        case "apiPort": return 443;
        case "apiBasePath": return "/v1";
        default: return undefined;
      }
    });
    
    const result = client.getProviderBaseUrl();
    
    expect(result).toBe("https://test.api.com:443/v1");
  });

  test("getProviderBaseUrl should handle missing port and basePath", () => {
    mockConfig.get.mockImplementation((key) => {
      switch (key) {
        case "apiProtocol": return "http";
        case "apiHostname": return "localhost";
        case "apiPort": return undefined;
        case "apiBasePath": return undefined;
        default: return undefined;
      }
    });
    
    const result = client.getProviderBaseUrl();
    
    expect(result).toBe("http://localhost");
  });

  test("getIsOpenAICompatible should identify compatible providers", () => {
    expect(client.getIsOpenAICompatible("openai-compatible")).toBe(true);
    expect(client.getIsOpenAICompatible("unknown-provider")).toBe(false);
  });

  test("handleConnection should set up peer and send join message", () => {
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = jest.fn() as unknown as typeof global.setTimeout;
    
    try {
      const mockPeer = {
        write: jest.fn(),
        on: jest.fn(),
      };
      
      const handleConnection = (client as unknown as {
        handleConnection: (peer: { write: jest.Mock; on: jest.Mock }) => void
      }).handleConnection;
      handleConnection(mockPeer);
      
      expect(mockPeer.write).toHaveBeenCalled();
      
      expect(mockPeer.on).toHaveBeenCalledWith("data", expect.any(Function));
      
      expect(global.setTimeout).toHaveBeenCalled();
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  });
});