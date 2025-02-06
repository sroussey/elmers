//    *******************************************************************************
//    *   ELLMERS: Embedding Large Language Model Experiential Retrieval Service    *
//    *                                                                             *
//    *   Copyright Steven Roussey <sroussey@gmail.com>                             *
//    *   Licensed under the Apache License, Version 2.0 (the "License");           *
//    *******************************************************************************

import { nanoid } from "nanoid";
import {
  Job,
  JobQueue,
  ILimiter,
  JobError,
  RetryableJobError,
  PermanentJobError,
  JobStatus,
} from "ellmers-core";
import { makeFingerprint } from "../../util/Misc";
import { ensureIndexedDbTable } from "./base/IndexedDbTable";

/**
 * IndexedDB implementation of a job queue.
 * Provides storage and retrieval for job execution states using IndexedDB.
 */
export class IndexedDbJobQueue<Input, Output> extends JobQueue<Input, Output> {
  private dbPromise: Promise<IDBDatabase>;

  constructor(
    queue: string,
    limiter: ILimiter,
    waitDurationInMilliseconds: number = 100,
    public version: number = 1
  ) {
    super(queue, limiter, waitDurationInMilliseconds);
    const tableName = `jobqueue_${queue}`;
    this.dbPromise = ensureIndexedDbTable(tableName, (db) => {
      const store = db.createObjectStore("jobs", { keyPath: "id" });
      store.createIndex("status", "status", { unique: false });
      store.createIndex("status_runAfter", ["status", "runAfter"], { unique: false });
      store.createIndex("jobRunId", "jobRunId", { unique: false });
      store.createIndex("taskType_fingerprint_status", ["taskType", "fingerprint", "status"], {
        unique: false,
      });
    });
  }

  async add(job: Job<Input, Output>): Promise<unknown> {
    job.id = job.id ?? nanoid();
    job.jobRunId = job.jobRunId ?? nanoid();
    job.queueName = this.queue;
    job.fingerprint = await makeFingerprint(job.input);

    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readwrite");
    tx.objectStore("jobs").add(job);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(job.id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(id: unknown): Promise<Job<Input, Output> | undefined> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readonly");
    const request = tx.objectStore("jobs").get(id as string);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined); // Not found
    });
  }

  async peek(num: number = 100): Promise<Job<Input, Output>[]> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readonly");
    const store = tx.objectStore("jobs");
    const index = store.index("status_runAfter");
    const request = index.getAll(IDBKeyRange.only(JobStatus.PENDING), num);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  }

  async processing(): Promise<Job<Input, Output>[]> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readonly");
    const store = tx.objectStore("jobs");
    const index = store.index("status");
    const request = index.getAll(IDBKeyRange.only(JobStatus.PROCESSING));

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  }

  async aborting(): Promise<Job<Input, Output>[]> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readonly");
    const store = tx.objectStore("jobs");
    const index = store.index("status");
    const request = index.getAll(IDBKeyRange.only(JobStatus.ABORTING));

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  }

  async next(): Promise<Job<Input, Output> | undefined> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readwrite");
    const store = tx.objectStore("jobs");

    const index = store.index("status_runAfter");
    const cursorRequest = index.openCursor(IDBKeyRange.only(JobStatus.PENDING), "next");

    return new Promise((resolve) => {
      cursorRequest.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const job = cursor.value;
          job.status = JobStatus.PROCESSING;
          cursor.update(job);
          resolve(job);
        } else {
          resolve(undefined); // No more jobs
        }
      };
    });
  }

  /**
   * Retrieves the number of jobs in the queue.
   * Returns the count of jobs in the queue.
   */
  async size(): Promise<number> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readonly");
    const store = tx.objectStore("jobs");
    const request = store.count();

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Marks a job as complete with its output or error.
   * Uses enhanced error handling to update the job's status.
   * If a retryable error occurred, the job's retry count is incremented and its runAfter updated.
   */
  async complete(id: unknown, output: Output | null = null, error?: JobError): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readwrite");
    const store = tx.objectStore("jobs");
    const request = store.get(id as string);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const job = request.result;
        if (!job) {
          reject(new Error(`Job ${id} not found`));
          return;
        }

        if (error) {
          job.error = error.message;
          job.retries = (job.retries || 0) + 1;
          if (error instanceof RetryableJobError) {
            if (job.retries >= job.maxRetries) {
              job.status = JobStatus.FAILED;
            } else {
              job.status = JobStatus.PENDING;
              job.runAfter = error.retryDate;
            }
          } else if (error instanceof PermanentJobError) {
            job.status = JobStatus.FAILED;
          } else {
            job.status = JobStatus.FAILED;
          }
        } else {
          job.status = JobStatus.COMPLETED;
          job.output = output;
        }

        store.put(job);

        if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
          this.onCompleted(job.id, job.status, output!, error);
        }

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Aborts a job by setting its status to "ABORTING".
   * This method will signal the corresponding AbortController so that
   * the job's execute() method (if it supports an AbortSignal parameter)
   * can clean up and exit.
   */
  async abort(jobId: unknown): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readwrite");
    const store = tx.objectStore("jobs");
    const request = store.get(jobId as string);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const job = request.result;
        if (!job) {
          reject(new Error(`Job ${jobId} not found`));
          return;
        }

        job.status = JobStatus.ABORTING;

        // Persist the updated job back to IndexedDB.
        const updateRequest = store.put(job);
        updateRequest.onsuccess = () => {
          this.abortJob(jobId);
          resolve();
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getJobsByRunId(jobRunId: string): Promise<Job<Input, Output>[]> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readonly");
    const store = tx.objectStore("jobs");
    const request = store.index("jobRunId").getAll(jobRunId);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Clears all jobs from the queue.
   */
  async deleteAll(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readwrite");
    const store = tx.objectStore("jobs");
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves the output for a job based on its task type and input.
   * Uses a compound key to query the IndexedDB for the job's output.
   */
  async outputForInput(taskType: string, input: Input): Promise<Output | null> {
    const db = await this.dbPromise;
    const tx = db.transaction("jobs", "readonly");
    const store = tx.objectStore("jobs");

    const fingerprint = await makeFingerprint(input);

    const index = store.index("taskType_fingerprint_status");
    // We use a compound key for querying in IndexedDB
    const queryKey = [taskType, fingerprint, JobStatus.COMPLETED];
    const request = index.get(queryKey);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (result.output ? (JSON.parse(result.output) as Output) : null) : null);
      };
      request.onerror = () => resolve(null); // In case of error, resolve with null
    });
  }
}
