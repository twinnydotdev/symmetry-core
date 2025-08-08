import { Logger, LogLevel, logger } from "../src/logger";
import chalk from "chalk";

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("Logger", () => {
  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;
  
  beforeEach(() => {
    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });
  
  test("getInstance should return a singleton instance", () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    
    expect(instance1).toBe(instance2);
  });
  
  test("setLogLevel should change the log level", () => {
    const loggerInstance = Logger.getInstance();
    
    loggerInstance.setLogLevel(LogLevel.DEBUG);
    loggerInstance.debug("Debug message");
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.gray("🐛 DEBUG:"),
      "Debug message"
    );
  });
  
  test("info should log info messages when log level is INFO or lower", () => {
    const loggerInstance = Logger.getInstance();
    
    loggerInstance.setLogLevel(LogLevel.INFO);
    loggerInstance.info("Info message");
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.blue("ℹ️ INFO:"),
      "Info message"
    );
    
    loggerInstance.setLogLevel(LogLevel.DEBUG);
    mockConsoleLog.mockClear();
    loggerInstance.info("Info message");
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.blue("ℹ️ INFO:"),
      "Info message"
    );
  });
  
  test("warning should log warning messages", () => {
    const loggerInstance = Logger.getInstance();
    
    loggerInstance.warning("Warning message");
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.yellow("⚠️ WARNING:"),
      "Warning message"
    );
  });
  
  test("error should log error messages", () => {
    const loggerInstance = Logger.getInstance();
    
    loggerInstance.error("Error message");
    expect(mockConsoleError).toHaveBeenCalledWith(
      chalk.red("❌ ERROR:"),
      "Error message"
    );
  });
  
  test("debug should log debug messages when log level is DEBUG", () => {
    const loggerInstance = Logger.getInstance();
    
    loggerInstance.setLogLevel(LogLevel.DEBUG);
    loggerInstance.debug("Debug message");
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.gray("🐛 DEBUG:"),
      "Debug message"
    );
  });
  
  test("exported logger instance should be a singleton", () => {
    expect(logger).toBe(Logger.getInstance());
  });
  
  test("should handle additional arguments", () => {
    const additionalArgs = [{ key: "value" }, 123, true];
    
    logger.info("Message", ...additionalArgs);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.blue("ℹ️ INFO:"),
      "Message",
      ...additionalArgs
    );
  });
});