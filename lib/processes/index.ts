import Worker from "../worker/index";

export interface ProcessOptions {
  maxWorkers?: number;
  lockLifetime?: number;
  maxRetries?: number;
}

export class Process {
  workers: Worker[] = [];
  name: string;
  fn: (data: any) => any;
  maxWorkers: number;
  maxRetries: number;
  busyWorkers: number = 0;
  lockLifetime: number;
  running: boolean = false;
  constructor(name: string, fn: () => any, options?: ProcessOptions) {
    this.name = name;
    this.fn = fn;
    this.maxWorkers = options?.maxWorkers || 5;
    this.maxRetries = options?.maxRetries || 0;
    this.lockLifetime = options?.lockLifetime || 60000;
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push(new Worker(i, this));
    }
  }

  getNextFreeWorker() {
    for (let each of this.workers) if (!each.isRunning) return each.id;
    return null;
  }
}
