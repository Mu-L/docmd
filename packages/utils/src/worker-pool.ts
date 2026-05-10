/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import { Worker } from 'node:worker_threads';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';

export interface WorkerTask {
  id: string;
  payload: any;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private freeWorkers: Worker[] = [];
  private taskQueue: { task: WorkerTask; resolve: (value: any) => void; reject: (reason: any) => void }[] = [];
  private activeTasks = new Map<Worker, string>();
  private isTerminated = false;
  private initialized = false;

  constructor(private workerScript: string, private workerData: any = {}, private poolSize: number = Math.max(1, os.cpus().length - 1)) {
    super();
    // Workers are created lazily on first task submission to avoid
    // paying the heavy initialisation cost when the pool is never used.
  }

  private ensureInitialized() {
    if (this.initialized || this.isTerminated) return;
    this.initialized = true;
    for (let i = 0; i < this.poolSize; i++) {
      this.addNewWorker();
    }
  }

  private addNewWorker() {
    if (this.isTerminated) return;

    const worker = new Worker(this.workerScript, { workerData: this.workerData });
    
    worker.on('message', (result: WorkerResult) => {
      this.emit('taskComplete', worker, result);
      this.freeWorkers.push(worker);
      this.activeTasks.delete(worker);
      this.processQueue();
    });

    worker.on('error', (err) => {
      this.emit('workerError', err, worker);
      this.replaceWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && !this.isTerminated) {
        this.emit('workerError', new Error(`Worker stopped with exit code ${code}`), worker);
        this.replaceWorker(worker);
      }
    });

    this.workers.push(worker);
    this.freeWorkers.push(worker);
  }

  private replaceWorker(worker: Worker) {
    if (this.isTerminated) return;
    
    this.workers = this.workers.filter(w => w !== worker);
    this.freeWorkers = this.freeWorkers.filter(w => w !== worker);
    
    const taskId = this.activeTasks.get(worker);
    if (taskId) {
      this.activeTasks.delete(worker);
      // Let the task listeners know this specific worker crashed so it can reject the promise
      this.emit('taskComplete', worker, { taskId, success: false, error: 'Worker crashed unexpectedly' });
    }

    if (this.workers.length < this.poolSize) {
       this.addNewWorker();
    }
    
    this.processQueue();
  }

  public runTask<T = any>(taskPayload: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.isTerminated) {
        return reject(new Error('WorkerPool has been terminated.'));
      }
      this.ensureInitialized();
      const taskId = Math.random().toString(36).substring(2, 11);
      const task: WorkerTask = { id: taskId, payload: taskPayload };
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.taskQueue.length === 0 || this.freeWorkers.length === 0 || this.isTerminated) {
      return;
    }

    const worker = this.freeWorkers.pop()!;
    const { task, resolve, reject } = this.taskQueue.shift()!;
    
    this.activeTasks.set(worker, task.id);

    const onTaskComplete = (w: Worker, result: WorkerResult) => {
      if (w === worker && result.taskId === task.id) {
        this.removeListener('taskComplete', onTaskComplete);
        this.removeListener('workerError', onError);
        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(result.error));
        }
      }
    };

    const onError = (err: Error, w: Worker) => {
      if (w === worker) {
        this.removeListener('taskComplete', onTaskComplete);
        this.removeListener('workerError', onError);
        reject(err);
      }
    };

    this.on('taskComplete', onTaskComplete);
    this.on('workerError', onError);

    worker.postMessage(task);
  }

  public async terminateAll() {
    this.isTerminated = true;
    
    // Reject any queued tasks
    for (const { reject } of this.taskQueue) {
      reject(new Error('WorkerPool terminated before task could be processed.'));
    }
    this.taskQueue = [];
    
    // Terminate all workers
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
    this.freeWorkers = [];
    this.activeTasks.clear();
  }
}