//    *******************************************************************************
//    *   ELLMERS: Embedding Large Language Model Experiential Retrieval Service    *
//    *                                                                             *
//    *   Copyright Steven Roussey <sroussey@gmail.com>                             *
//    *   Licensed under the Apache License, Version 2.0 (the "License");           *
//    *******************************************************************************

import { Model, ModelProviderEnum, ModelUseCaseEnum } from "../../../../ai/src/model/Model";

export class GgmlLocalModel extends Model {
  constructor(name: string, useCase: ModelUseCaseEnum[], options?: ModelOptions) {
    super(name, useCase, options);
  }
  readonly type = ModelProviderEnum.LOCAL_LLAMACPP;
}
