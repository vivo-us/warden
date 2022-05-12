import { Process, ProcessOptions } from "./../processes/index";
import { DateTime } from "luxon";
import { EventEmitter } from "events";
import { Sequelize } from "sequelize";
import Queue from "../queue/index";
import { schedule } from "./scheduling";
import init from "./init-db";
import start from "./start";
import stop from "./stop";
import { logger } from "../logging/logger";

export const emitter = new EventEmitter();
interface Options {
  db: Database | Sequelize;
  frequency?: number;
  maxConcurrent?: number;
}

interface Database {
  name: string;
  username: string;
  password: string;
  host: string;
  port: number;
  logging?: boolean;
}

interface Processes {
  [key: string]: Process;
}

class Warden {
  processesToDistribute: Array<Array<string>> = [];
  distributing: boolean = false;
  queueUpdated: boolean = false;
  emitter: EventEmitter = emitter;
  processInterval: any = null;
  maxConcurrent: number;
  processes: Processes;
  processing: boolean;
  database: Sequelize;
  initiated: boolean;
  frequency: number;
  queue: Queue;
  nextScan: DateTime;
  schedule!: typeof schedule;
  start!: typeof start;
  stop!: typeof stop;
  init!: typeof init;

  constructor(options: Options) {
    if (options.db instanceof Sequelize) this.database = options.db;
    else {
      this.database = new Sequelize(
        options.db.name,
        options.db.username,
        options.db.password,
        {
          host: options.db.host,
          port: options.db.port || 3306,
          dialect: "mysql",
          logging: options.db.logging || false,
        }
      );
    }
    this.nextScan = DateTime.now();
    this.queue = new Queue();
    this.processing = false;
    this.initiated = false;
    this.processes = {};
    this.frequency = options.frequency || 300000;
    this.maxConcurrent = options.maxConcurrent || 10;
    this.emitter.addListener("queue-filled", (jobsToRun: any[]) => {
      logger.info(`Queue filled. ${this.queue.queue.length} job(s) to run.`);
      this.processesToDistribute.push(jobsToRun);
      this.distribute();
    });
    this.emitter.addListener("job-ready", (jobName) => {
      logger.debug(`Job ${jobName} ready.`);
      this.processesToDistribute.push([jobName]);
      this.distribute();
    });
    this.emitter.addListener("worker-ready", (jobName) => {
      this.processesToDistribute.push([jobName]);
      this.distribute();
    });
  }

  createProcess(name: string, func: () => any, options?: ProcessOptions) {
    try {
      if (!this.initiated) throw new Error("Warden not initiated.");
      let nextId = Object.keys(this.processes).length + 1;
      let process = new Process(nextId, name, func, options);
      this.processes[name] = process;
      return process;
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }

  distribute() {
    try {
      if (this.distributing) return;
      this.distributing = true;
      let more = true;
      while (more) {
        let array = this.processesToDistribute.shift();
        if (!array) break;
        let length = this.queue.queue.length;
        if (length === 0) break;
        for (let each in this.processes) {
          if (!array.includes(each)) continue;
          let freeWorkers = true;
          while (freeWorkers) {
            let freeWorker = this.processes[each].getNextFreeWorker();
            if (freeWorker === null) break;
            let job = this.queue.getNextJob(each);
            if (!job) break;
            this.emitter.emit("assigned", {
              nextScan: this.nextScan,
              job,
              processName: each,
              workerId: freeWorker,
            });
          }
        }
      }
      this.distributing = false;
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }
}

Warden.prototype.schedule = schedule;
Warden.prototype.start = start;
Warden.prototype.init = init;
Warden.prototype.stop = stop;

export default Warden;
