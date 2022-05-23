import { parseExpression } from "cron-parser";
import { logger } from "./../logging/logger";
import { Job as JobModel } from "./init-db";
import Warden from ".";
import Job from "../job";

interface UpdateConfig {
  recurrance?: string;
  data?: any;
  nextRunAt?: Date;
}

async function updateJob(
  this: Warden,
  jobId: number,
  updateConfig: UpdateConfig
) {
  try {
    let { recurrance, nextRunAt } = updateConfig;
    if (recurrance && !nextRunAt) {
      updateConfig.nextRunAt = parseExpression(recurrance, { tz: "UTC" })
        .next()
        .toDate();
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
        nextRunAt: config.nextRunAt,
        lockedAt: config.lockedAt,
        status: config.status,
      },
      this.processes[config.name]
    );
    this.queue.update(job);
    this.emitter.emit("job-updated", job);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export default updateJob;
