import { Job as JobModel, JobStatus } from "./init-db";
import Job, { JobConfig } from "../job/index";
import { parseExpression } from "cron-parser";
import { logger } from "../logging/logger";
import { Process } from "../processes/index";
import Warden from "../warden/index";
import { DateTime } from "luxon";

interface Config {
  name: string;
  status: JobStatus;
  data: any;
  recurrance: null | string;
  nextRunAt: null | Date;
}

interface Options {
  runAt?: Date;
  cron?: string;
  maxRetries?: number;
}

export async function schedule(
  this: Warden,
  process: Process,
  data: any,
  options: Options = {}
) {
  try {
    if (!this.processes[process.name])
      throw new Error(`This warden does not own the process ${process.name}.`);
    let config: Config = {
      name: process.name,
      status: JobStatus.Created,
      data: data,
      recurrance: null,
      nextRunAt: new Date(),
    };
    if (options.cron) {
      config.recurrance = options.cron;
      let cronFields = parseExpression(options.cron, { tz: this.timezone });
      config.nextRunAt = DateTime.fromJSDate(cronFields.next().toDate())
        .toUTC()
        .toJSDate();
    }
    if (options.runAt) config.nextRunAt = options.runAt;
    let job = await JobModel.create(config);
    let jobConfig: JobConfig = {
      id: job.jobId,
      name: job.name,
      recurrance: job.recurrance,
      timezone: this.timezone,
      data: job.data,
      status: job.status,
      numberOfRetries: job.numberOfRetries,
      nextRunAt: job.nextRunAt,
      lockedAt: job.lockedAt,
    };
    let jobInstance = new Job(jobConfig, process);
    this.queue.add(jobInstance);
    this.emitter.emit("job-added");
    logger.debug(`Job ${job.name} scheduled successfully.`);
    return jobInstance;
  } catch (error: any) {
    throw new Error(`Warden failed to schedule job: ${error.message}`);
  }
}
