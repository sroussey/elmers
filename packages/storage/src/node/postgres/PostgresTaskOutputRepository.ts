//    *******************************************************************************
//    *   ELLMERS: Embedding Large Language Model Experiential Retrieval Service    *
//    *                                                                             *
//    *   Copyright Steven Roussey <sroussey@gmail.com>                             *
//    *   Licensed under the Apache License, Version 2.0 (the "License");           *
//    *******************************************************************************

import {
  DefaultValueType,
  TaskOutputPrimaryKey,
  TaskOutputPrimaryKeySchema,
  TaskOutputRepository,
} from "ellmers-core";
import { PostgresKVRepository } from "./base/PostgresKVRepository";
import { Sql } from "postgres";

/**
 * PostgreSQL implementation of a task output repository.
 * Provides storage and retrieval for task outputs using PostgreSQL.
 */
export class PostgresTaskOutputRepository extends TaskOutputRepository {
  kvRepository: PostgresKVRepository<
    TaskOutputPrimaryKey,
    DefaultValueType,
    typeof TaskOutputPrimaryKeySchema
  >;
  public type = "PostgresTaskOutputRepository" as const;
  constructor(sql: Sql) {
    super();
    this.kvRepository = new PostgresKVRepository<
      TaskOutputPrimaryKey,
      DefaultValueType,
      typeof TaskOutputPrimaryKeySchema
    >(sql, "task_outputs", TaskOutputPrimaryKeySchema);
  }
}
