import { JobStatus } from "../warden/init-db";
import { DateTime } from "luxon";
import { Process } from "./../processes/index";
import { logger } from "../logging/logger";

export interface JobConfig {
  id: number;
  name: string;
  recurrance: string | null;
  data: any;
  status: JobStatus;
  nextRunAt: Date | null;
  lockedAt: Date | null;
}

export default class Job {
  id: number;
  name: string;
  process: Process;
  recurrance: string | null;
  data: any;
  status: JobStatus;
  nextRunAt: DateTime | null = null;
  lockedAt: DateTime | null = null;
  timeout: any | null = null;
  constructor(job: JobConfig, process: Process) {
    this.id = job.id;
    this.name = job.name;
    this.process = process;
    this.recurrance = job.recurrance;
    this.status = job.status;
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
    try {
      let res = await this.process.fn(this.data);
      return res;
    } catch (error: any) {
      logger.error(error.message);
      return error;
    }
  }
}
