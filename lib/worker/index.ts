import { Job as JobModel, LastRunStatus, JobStatus } from "../warden/init-db";
import { parseExpression } from "cron-parser";
import { Process } from "../processes/index";
import { logger } from "../logging/logger";
import { emitter } from "../warden/index";
import { EventEmitter } from "events";
import { DateTime } from "luxon";
import Job from "../job/index";

export interface AssignedData {
  job: Job;
  processName: string;
  workerId: number;
  nextScan: DateTime;
}

interface Obj {
  status: JobStatus;
  lockedAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: LastRunStatus;
  nextRunAt: Date | null;
  numberOfRetries: number;
}

export default class Worker {
  id: number;
  process: Process;
  isRunning: boolean = false;
  emitter: EventEmitter = emitter;
  nextScan: DateTime | null = null;
  constructor(id: number, process: Process) {
    this.id = id;
    this.process = process;
    this.emitter.addListener("assigned", async (data: AssignedData) => {
      await this.processJob(data);
    });
  }

  async processJob(data: AssignedData) {
    let { job, processName, workerId, nextScan } = data;
    if (workerId !== this.id || processName !== this.process.name) return;
    this.isRunning = true;
    this.nextScan = nextScan;
    logger.debug(`Worker ${this.id} starting job ${job.name} ${job.id}`);
    let goodToGo = await this.lockJob(job);
    if (!goodToGo) {
      this.isRunning = false;
      logger.debug(`Job ${job.id} already locked`);
      return;
    }
    logger.debug(`Worker ${this.id} executing job ${job.name} ${job.id}`);
    await this.executeJob(job);
    this.isRunning = false;
    logger.debug(`Worker ${this.id} completed job ${job.name} ${job.id}`);
    this.emitter.emit("worker-ready", job.name);
  }

  async lockJob(job: Job) {
    try {
      let [rowsAffected] = await JobModel.update(
        {
          status: JobStatus.Running,
          lockedAt: new Date(),
        },
        {
          where: { jobId: job.id, lockedAt: null },
        }
      );
      if (rowsAffected === 0) return false;
      else return true;
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }

  async executeJob(job: Job) {
    try {
      await job.run();
      await this.handleResults(job, LastRunStatus.Success);
    } catch (err: any) {
      logger.error(`Warden job ended with error: ${err.message}`);
      await this.handleResults(job, LastRunStatus.Failure);
    }
  }

  async handleResults(job: Job, status: LastRunStatus) {
    try {
      if (status === LastRunStatus.Success) {
        let recurrance = null;
        let obj: Obj = {
          status: job.recurrance ? JobStatus.Created : JobStatus.Done,
          lockedAt: null,
          lastRunAt: DateTime.now().toJSDate(),
          lastRunStatus: status,
          nextRunAt: null,
          numberOfRetries: job.numberOfRetries,
        };
        if (job.recurrance) {
          recurrance = DateTime.fromJSDate(
            parseExpression(job.recurrance, { tz: job.timezone })
              .next()
              .toDate()
          ).toUTC();
          obj.nextRunAt = recurrance.toJSDate();
          if (this.nextScan && recurrance > this.nextScan) {
            this.emitter.emit("remove-job", job);
          } else {
            job.nextRunAt = recurrance;
            job.status = JobStatus.Created;
            this.emitter.emit("job-updated");
          }
        } else {
          this.emitter.emit("remove-job", job);
        }
        await JobModel.update(obj, { where: { jobId: job.id } });
      } else if (status === LastRunStatus.Failure) {
        let shouldRetry = job.numberOfRetries < this.process.maxRetries;
        if (shouldRetry) {
          job.numberOfRetries++;
          let obj: Obj = {
            status: JobStatus.Retry,
            lockedAt: null,
            lastRunAt: DateTime.now().toJSDate(),
            lastRunStatus: status,
            nextRunAt: DateTime.now().toJSDate(),
            numberOfRetries: job.numberOfRetries,
          };
          await JobModel.update(obj, { where: { jobId: job.id } });
          job.status = JobStatus.Retry;
          job.lockedAt = null;
          job.nextRunAt = DateTime.now();
          this.emitter.emit("job-updated");
        } else {
          let obj: Obj = {
            status: JobStatus.Failed,
            lockedAt: null,
            lastRunAt: DateTime.now().toJSDate(),
            lastRunStatus: status,
            nextRunAt: null,
            numberOfRetries: job.numberOfRetries,
          };
          await JobModel.update(obj, { where: { jobId: job.id } });
          this.emitter.emit("remove-job", job);
        }
      }
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }
}
