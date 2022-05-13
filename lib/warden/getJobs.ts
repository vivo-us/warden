import { logger } from "../logging/logger";
import { Job, JobStatus } from "./init-db";
import Warden from "../warden/index";
import { Op } from "sequelize";

export interface Options {
  processName?: string;
  jobId?: number;
  status?: Array<string>;
}

interface Statement {
  where: {
    status: Status;
    name?: string;
    jobId?: number;
  };
  order: Array<any>;
}

interface Status {
  [Op.or]: Array<string>;
}

export default async function getJobs(this: Warden, options: Options = {}) {
  try {
    if (!this.processInterval) throw new Error("Warden not initiated.");
    if (options.status) {
      let values: Array<string> = Object.values(JobStatus);
      for (let each of options.status) {
        if (!values.includes(each)) {
          throw new Error(`Invalid job status: ${each}`);
        }
      }
    }
    let statement: Statement = {
      where: { status: { [Op.or]: ["created", "pending", "running"] } },
      order: [["nextRunAt", "ASC"]],
    };
    if (options.processName) statement.where.name = options.processName;
    if (options.jobId) statement.where.jobId = options.jobId;
    if (options.status) statement.where.status = { [Op.or]: options.status };
    let jobs = await Job.findAll(statement);
    let formattedJobs: any[] = [];
    for (let job of jobs) formattedJobs.push(job.toJSON());
    return formattedJobs;
  } catch (error: any) {
    logger.error(error.message);
    throw error;
  }
}
