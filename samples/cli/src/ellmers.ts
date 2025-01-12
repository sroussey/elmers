#!/usr/bin/env bun

import { program } from "commander";
import { argv } from "process";
import { AddBaseCommands } from "./TaskCLI";
import { getProviderRegistry } from "ellmers-ai";
import { registerHuggingfaceLocalTasksInMemory } from "ellmers-provider/hf-transformers/server";
import { registerMediaPipeTfJsLocalInMemory } from "ellmers-provider/tf-mediapipe/server";

program.version("1.0.0").description("A CLI to run Ellmers.");

AddBaseCommands(program);

registerHuggingfaceLocalTasksInMemory();
registerMediaPipeTfJsLocalInMemory();

await program.parseAsync(argv);

getProviderRegistry().stopQueues();
