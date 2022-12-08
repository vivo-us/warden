import { Process } from "../processes/index";
import { JobStatus } from "../warden/init-db";
import { logger } from "../logging/logger";
import { DateTime } from "luxon";
import { Job as JobModel } from "../warden/init-db";

export interface JobConfig {
  id: number;
  name: string;
  recurrance: string | null;
  timezone: string;
  data: any;
  status: JobStatus;
  numberOfRetries: number;
  nextRunAt: Date | null;
  lockedAt: Date | null;
}

export default class Job {
  id: number;
  name: string;
  process: Process;
  recurrance: string | null;
  timezone: string;
  data: any;
  status: JobStatus;
  numberOfRetries: number;
  nextRunAt: DateTime | null = null;
  lockedAt: DateTime | null = null;
  timeout: any | null = null;
  constructor(job: JobConfig, process: Process) {
    this.id = job.id;
    this.name = job.name;
    this.process = process;
    this.recurrance = job.recurrance;
    this.timezone = job.timezone || "UTC";
    this.status = job.status;
    this.numberOfRetries = job.numberOfRetries;
    this.data = job.data;
    if (job.nextRunAt) {
      this.nextRunAt = DateTime.fromJSDate(job.nextRunAt, {
        zone: "utc",
      });
    }
    if (job.lockedAt) {
      this.lockedAt = DateTime.fromJSDate(job.lockedAt, {
        zone: "utc",
      });
    }
  }

  async run() {
    let interval = setInterval(async () => {
      try {
        await JobModel.update(
          { lockedAt: new Date() },
          { where: { jobId: this.id } }
        );
      } catch (error) {
        logger.error(error);
      }
    }, this.process.lockLifetime / 2);
    try {
      let res = await this.process.fn(this.data);
      clearInterval(interval);
      return res;
    } catch (error: any) {
      clearInterval(interval);
      throw error;
    }
  }
}
