//    *******************************************************************************
//    *   ELLMERS: Embedding Large Language Model Experiential Retrieval Service    *
//    *                                                                             *
//    *   Copyright Steven Roussey <sroussey@gmail.com>                             *
//    *   Licensed under the Apache License, Version 2.0 (the "License");           *
//    *******************************************************************************

/*

TODO: Still need to save the task tree to disc to restore later, though the JSON
strategy might be the thing to use.

*/

import { Model } from "#/Model";
import {
  ParallelStrategy,
  ParallelTaskList,
  SerialTaskList,
  StreamableTaskType,
  TaskConfig,
  TaskStream,
} from "#/Task";
import { forceArray } from "#/util/Misc";
import { EmbeddingTask, RewriterTask, SummarizeTask } from "./FactoryTasks";

export interface EmbeddingStrategyInput {
  text: string;
  models: Model[];
}
export class EmbeddingStrategy extends ParallelStrategy {
  declare input: EmbeddingStrategyInput;
  readonly type: StreamableTaskType = "EmbeddingStrategy";
  constructor(config: TaskConfig = {}, defaults?: EmbeddingStrategyInput) {
    super(config, defaults);
  }

  generateTasks() {
    const tasks = this.input.models.map(
      (model) => new EmbeddingTask({}, { text: this.input.text, model })
    );

    this.setTasks(tasks);
  }
}

export interface SummarizeStrategyInput {
  text: string;
  models: Model[];
}
export class SummarizeStrategy extends ParallelStrategy {
  declare input: SummarizeStrategyInput;
  readonly type: StreamableTaskType = "SummarizeStrategy";

  constructor(config: TaskConfig = {}, defaults?: SummarizeStrategyInput) {
    super(config, defaults);
  }

  generateTasks() {
    const tasks = this.input.models.map(
      (model) => new SummarizeTask({}, { text: this.input.text, model })
    );
    this.setTasks(tasks);
  }
}

export interface RewriterStrategyInput {
  text: string;
  prompt?: string | string[];
  model?: Model | Model[];
  prompt_model_pair?: { prompt: string; model: Model }[];
}
export class RewriterStrategy extends ParallelStrategy {
  declare input: RewriterStrategyInput;
  readonly type: StreamableTaskType = "RewriterStrategy";

  constructor(config: TaskConfig = {}, defaults?: RewriterStrategyInput) {
    super(config, defaults);
  }

  generateTasks() {
    const name = this.config.name || `Vary Rewriter content`;
    const { text, prompt_model_pair, model, prompt } = this.input;
    let pairs: { prompt: string; model: Model }[] = [];
    if (prompt_model_pair) {
      pairs = forceArray(prompt_model_pair);
    } else {
      if (!prompt || !model) throw new Error("Invalid input");
      const models = forceArray(model);
      const prompts = forceArray(prompt);
      for (const model of models) {
        for (const prompt of prompts) {
          pairs.push({ prompt, model });
        }
      }
    }
    const tasks = pairs.map(
      ({ prompt, model }) => new RewriterTask({}, { text, prompt, model })
    );

    this.setTasks(tasks);
  }
}

export interface RewriterEmbeddingStrategyInput {
  text: string;
  prompt?: string | string[];
  prompt_model?: Model | Model[];
  embed_model?: Model | Model[];
  prompt_model_tuple?: {
    prompt: string;
    prompt_model: Model;
    embed_model: Model;
  }[];
}

export class RewriterEmbeddingStrategy extends ParallelStrategy {
  declare input: RewriterEmbeddingStrategyInput;
  readonly type: StreamableTaskType = "RewriterEmbeddingStrategy";
  constructor(config: TaskConfig, defaults: RewriterEmbeddingStrategyInput) {
    super(config, defaults);
  }

  generateTasks() {
    const name = this.config.name || `RewriterEmbeddingStrategy`;
    const { text, prompt_model_tuple, prompt, embed_model, prompt_model } =
      this.input;
    let tasks: TaskStream = [];
    if (prompt_model_tuple) {
      const tuples = forceArray(prompt_model_tuple);
      tasks = tuples.map(({ prompt, prompt_model, embed_model }) => {
        return new SerialTaskList({ name }, [
          new RewriterTask(
            { name: name + " Rewriter" },
            { text, prompt, model: prompt_model }
          ),
          new EmbeddingTask(
            { name: name + " Embedding" },
            { text, model: embed_model }
          ),
        ]);
      });
    } else {
      if (!prompt || !prompt_model || !embed_model)
        throw new Error("Invalid input");
      const prompt_models = forceArray(prompt_model);
      const embed_models = forceArray(embed_model);
      const prompts = forceArray(prompt);
      for (const prompt of prompts) {
        tasks.push(
          new ParallelTaskList({ name }, [
            new RewriterStrategy(
              { name: name + " Rewriter" },
              { text, prompt, model: prompt_models }
            ),
            new EmbeddingStrategy(
              { name: name + " Embedding" },
              { text, models: embed_models }
            ),
          ])
        );
      }
    }
    this.setTasks(tasks);
  }
}
