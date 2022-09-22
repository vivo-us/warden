import Worker from "../worker/index";

export interface ProcessOptions {
  isActive?: boolean;
  maxWorkers?: number;
  lockLifetime?: number;
  maxRetries?: number;
}

export class Process {
  isActive: boolean = true;
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
    this.maxWorkers =
      options?.maxWorkers !== undefined ? options.maxWorkers : 1;
    this.maxRetries = options?.maxRetries || 0;
    this.lockLifetime = options?.lockLifetime || 60000;
    if (options?.isActive !== undefined) this.isActive = options.isActive;
    if (!this.isActive) this.maxWorkers = 0;
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push(new Worker(i, this));
    }
  }

  getNextFreeWorker() {
    if (!this.isActive) return null;
    for (let each of this.workers) if (!each.isRunning) return each.id;
    return null;
  }
}
