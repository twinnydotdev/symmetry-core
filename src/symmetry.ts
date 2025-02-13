#!/usr/bin/env node
import { Command } from "commander";
import os from "os";
import path from "path";
import { SymmetryClient } from "./client";
import { version } from "../package.json";

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".config", "symmetry", "provider.yaml");

async function run(configPath: string): Promise<void> {
  try {
    const client = new SymmetryClient(configPath);
    await client.init();
  } catch (error) {
    console.error("Error initializing Symmetry client:", error);
    process.exit(1);
  }
}

const program = new Command();

program
  .version(version)
  .description("Symmetry CLI")
  .option("-c, --config <path>", "Path to config file", DEFAULT_CONFIG_PATH)
  .action(async (options) => {
    await run(options.config);
  });

program
  .command("version")
  .description("Display the version of Symmetry")
  .action(() => {
    console.log(`Symmetry version: ${version}`);
  });

program.parse(process.argv);
