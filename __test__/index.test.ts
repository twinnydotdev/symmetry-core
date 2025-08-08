import * as symmetryCore from "../src/index";
import { SymmetryClient } from "../src/client";
import { ConfigManager } from "../src/config";
import { logger } from "../src/logger";
import * as utils from "../src/utils";
import * as providers from "../src/providers";

describe("Index exports", () => {
  test("should export SymmetryClient", () => {
    expect(symmetryCore.SymmetryClient).toBe(SymmetryClient);
  });
  
  test("should export ConfigManager", () => {
    expect(symmetryCore.ConfigManager).toBe(ConfigManager);
  });
  
  
  test("should export logger", () => {
    expect(symmetryCore.logger).toBe(logger);
  });
  
  test("should export utility functions", () => {
    expect(symmetryCore.safeParseJson).toBe(utils.safeParseJson);
    expect(symmetryCore.createMessage).toBe(utils.createMessage);
  });
  
  test("should export providers", () => {
    expect(symmetryCore).toHaveProperty("BaseProvider");
    expect(symmetryCore.BaseProvider).toBe(providers.BaseProvider);
    expect(symmetryCore).toHaveProperty("LlamaCppProvider");
    expect(symmetryCore.LlamaCppProvider).toBe(providers.LlamaCppProvider);
  });
  
});