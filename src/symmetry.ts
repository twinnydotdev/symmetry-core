#!/usr/bin/env node
import { Command } from "commander";
import os from "os";
import path from "path";

import { SymmetryClient  } from "./client";

const program = new Command();

program
  .version("1.0.33")
  .description("symmetry")
  .option(
    "-c, --config <path>",
    "Path to config file",
    path.join(os.homedir(), ".config", "symmetry", "provider.yaml")
  )
  .action(async () => {
    const client = new SymmetryClient(program.opts().config);
    await client.init();
  });

program.parse(process.argv);
