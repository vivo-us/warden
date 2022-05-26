import { parseExpression } from "cron-parser";
import { logger } from "./../logging/logger";
import { Job as JobModel } from "./init-db";
import Warden from ".";
import Job from "../job";
import { DateTime } from "luxon";

interface UpdateConfig {
  cron?: string;
  data?: any;
  nextRunAt?: Date;
}

async function updateJob(
  this: Warden,
  jobId: number,
  updateConfig: UpdateConfig
) {
  try {
    let { cron, nextRunAt } = updateConfig;
    if (cron && !nextRunAt) {
      updateConfig.nextRunAt = DateTime.fromJSDate(
        parseExpression(cron, { tz: this.timezone }).next().toDate()
      )
        .toUTC()
        .toJSDate();
    }
    await JobModel.update(updateConfig, { where: { jobId } });
    let config = await JobModel.findByPk(jobId);
    if (!config) return;
    let job = new Job(
      {
        id: jobId,
        name: config.name,
        data: config.data,
        recurrance: config.recurrance,
        timezone: this.timezone,
        nextRunAt: config.nextRunAt,
        lockedAt: config.lockedAt,
        status: config.status,
      },
      this.processes[config.name]
    );
    this.queue.update(job);
    this.emitter.emit("job-updated", job);
    return job;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export default updateJob;
