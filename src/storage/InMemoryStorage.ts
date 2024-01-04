//    ****************************************************************************
//    *   ELMERS: Embedding Language Model Experiential Retrieval Service        *
//    *                                                                          *
//    *   Copyright Steven Roussey <sroussey@gmail.com>                          *
//    *   Licensed under the Apache License, Version 2.0 (the "License");        *
//    ****************************************************************************

import { Instruct, InstructList } from "#/Instruct";
import { ModelList, ONNXTransformerJsModel } from "#/Model";
import { StrategyList } from "#/Strategy";

export const supabaseGteSmall = new ONNXTransformerJsModel(
  "Supabase/gte-small",
  384,
  {},
  "feature-extraction"
);
export const xenovaBgeSmallEnV15 = new ONNXTransformerJsModel(
  "Xenova/bge-small-en-v1.5",
  384,
  {},
  "feature-extraction"
);
export const whereIsAIUAELargeV1 = new ONNXTransformerJsModel(
  "WhereIsAI/UAE-Large-V1",
  1024,
  {},
  "feature-extraction"
);

export const xenovaDistilbert = new ONNXTransformerJsModel(
  "Xenova/distilbert-base-uncased-distilled-squad",
  384,
  {},
  "question-answering"
);

export const featureExtractionModelList: ModelList = [
  supabaseGteSmall,
  xenovaBgeSmallEnV15,
  whereIsAIUAELargeV1,
];

export const instructPlain = new Instruct(
  "Plain",
  "The plain version does nothing extra to queries or storage",
  "",
  "",
  {}
);

export const instructHighTemp = new Instruct(
  "HighTemp",
  "This is similar to plain but with a higher temperature and four versions averaged together",
  "",
  "",
  { temperature: 2.5, versions: 4 }
);

export const instructQuestion = new Instruct(
  "EverythingIsAQuestion",
  "This converts storage into questions",
  "",
  "Rephrase the following as a question: ",
  {}
);

export const instructRepresent = new Instruct(
  "Represent",
  "This tries to coax the model into representing the query or passage",
  "Represent this query for searching relevant passages: ",
  "Represent this passage for later retrieval: ",
  {}
);

export const instructKeywords = new Instruct(
  "Keywords",
  "Try and pull keywords and concepts from both query and storage",
  "What are the most important keywords and concepts that represent the following: ",
  "What are the most important keywords and concepts that represent the following: ",
  {}
);

export const instructList: InstructList = [
  instructPlain,
  instructHighTemp,
  instructQuestion,
  instructRepresent,
  instructKeywords,
];

export const strategyAllPairs: StrategyList = [];

for (const model of featureExtractionModelList) {
  for (const instruct of instructList) {
    strategyAllPairs.push({ model, instruct });
  }
}
