import { SymmetryClient } from "../src/client";
import yaml from "js-yaml";

jest.mock("hyperswarm", () => {
  return jest.fn().mockImplementation(() => ({
    join: jest
      .fn()
      .mockReturnValue({ flushed: jest.fn().mockResolvedValue(undefined) }),
    on: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined),
  }));
});

jest.mock("hypercore-crypto", () => ({
  discoveryKey: jest.fn().mockReturnValue("test"),
  keyPair: jest.fn().mockReturnValue({
    publicKey: "test-public-key",
    secretKey: "test-secret-key",
  }),
  sign: jest.fn(),
}));

jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock("js-yaml", () => ({
  load: jest.fn(),
}));

describe("Symmetry", () => {
  let client: SymmetryClient;
  const mockConfig = {
    path: "/test/path",
    temperature: 1,
    apiHostname: "test.api.com",
    apiPort: 443,
    apiChatPath: "/v1/chat",
    dataPath: "",
    apiProtocol: "https",
    apiKey: "test-api-key",
    apiProvider: "test-provider",
    modelName: "test-model",
    name: "test",
    public: false,
    serverKey: "test-server-key",
    systemMessage: "test-system-message",
    userSecret: "arse",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (yaml.load as jest.Mock).mockReturnValue(mockConfig);
    client = new SymmetryClient("mock-config.yaml");
  });

  test("init method sets up the writer correctly", async () => {
    await client.init();
  });
});
