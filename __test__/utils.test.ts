import { safeParseJson, createMessage } from "../src/utils";
import { serverMessageKeys } from "../src/constants";

describe("Utils", () => {
  describe("safeParseJson", () => {
    test("should parse valid JSON", () => {
      const validJson = '{"key": "value", "number": 123}';
      const result = safeParseJson(validJson);
      
      expect(result).toEqual({
        key: "value",
        number: 123
      });
    });
    
    test("should return undefined for invalid JSON", () => {
      const invalidJson = '{key: value}';
      const result = safeParseJson(invalidJson);
      
      expect(result).toBeUndefined();
    });
    
    test("should handle empty string", () => {
      const result = safeParseJson("");
      
      expect(result).toBeUndefined();
    });
  });
  
  describe("createMessage", () => {
    test("should create a message with key and data", () => {
      const key = serverMessageKeys.inference;
      const data = { test: "data" };
      
      const result = createMessage(key, data);
      
      expect(result).toBe(JSON.stringify({ key, data }));
    });
    
    test("should create a message with only key when no data is provided", () => {
      const key = serverMessageKeys.healthCheck;
      
      const result = createMessage(key);
      
      expect(result).toBe(JSON.stringify({ key, data: undefined }));
    });
    
    test("should handle null data", () => {
      const key = serverMessageKeys.inference;
      const data = null;
      
      const result = createMessage(key, data);
      
      expect(result).toBe(JSON.stringify({ key, data }));
    });
  });
});