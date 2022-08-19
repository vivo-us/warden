import { EventEmitter } from "events";
import { Sequelize } from "sequelize";
import { DateTime } from "luxon";
import { Process } from "../processes/index";
import createProcess from "./createProcess";
import { logger } from "../logging/logger";
import { schedule } from "./scheduling";
import distribute from "./distribute";
import updateJob from "./updateJob";
import cancelJob from "./cancelJob";
import Queue from "../queue/index";
import getJobs from "./getJobs";
import assign from "./assign";
import init from "./init-db";
import start from "./start";
import stop from "./stop";

export const emitter = new EventEmitter();
interface Options {
  db: Database | Sequelize;
  frequency?: number;
  maxConcurrent?: number;
  timezone?: string;
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
  timezone: string;
  processes: Processes;
  processing: boolean;
  database: Sequelize;
  initiated: Promise<unknown>;
  frequency: number;
  queue: Queue;
  nextScan: DateTime;
  createProcess!: typeof createProcess;
  distribute!: typeof distribute;
  updateJob!: typeof updateJob;
  cancelJob!: typeof cancelJob;
  schedule!: typeof schedule;
  getJobs!: typeof getJobs;
  assign!: typeof assign;
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
    this.timezone = options.timezone || "UTC";
    this.nextScan = DateTime.now();
    this.processing = false;
    this.initiated = new Promise((resolve) => {
      this.emitter.on("db-initiated", resolve);
    });
    this.processes = {};
    this.frequency = options.frequency || 300000;
    this.queue = new Queue({
      frequency: this.frequency,
      nextRunAt: this.nextScan,
    });
    this.maxConcurrent = options.maxConcurrent || 10;
    this.emitter.addListener("queue-filled", (jobsToRun: any[]) => {
      logger.info(`Queue filled. ${this.queue.queue.length} job(s) to run.`);
      if (this.processing) {
        this.processesToDistribute.push(jobsToRun);
        this.distribute.call(this);
      }
    });
    this.emitter.addListener("queue-updated", async (jobsToRun: any[]) => {
      logger.info(`Queue Updated. ${this.queue.queue.length} job(s) to run.`);
      if (this.processing) {
        this.processesToDistribute.push(jobsToRun);
        await this.distribute.call(this);
      }
    });
    this.emitter.addListener("job-ready", async (jobName) => {
      logger.debug(`Job ${jobName} ready.`);
      if (this.processing) {
        this.processesToDistribute.push([jobName]);
        await this.distribute.call(this);
      }
    });
    this.emitter.addListener("worker-ready", async (jobName) => {
      if (this.processing) {
        this.processesToDistribute.push([jobName]);
        await this.distribute.call(this);
      }
    });
    this.init();
  }
}

Warden.prototype.createProcess = createProcess;
Warden.prototype.distribute = distribute;
Warden.prototype.updateJob = updateJob;
Warden.prototype.cancelJob = cancelJob;
Warden.prototype.schedule = schedule;
Warden.prototype.getJobs = getJobs;
Warden.prototype.assign = assign;
Warden.prototype.start = start;
Warden.prototype.init = init;
Warden.prototype.stop = stop;

export default Warden;
