import { logger } from "../logging/logger";
import Warden from "./index";
import { Job, JobStatus } from "./init-db";

export default async function cancel(this: Warden, jobId: number) {
  try {
    this.queue.remove(jobId);
    await Job.update(
      { nextRunAt: null, status: JobStatus.Cancelled },
      { where: { jobId } }
    );
    logger.info(`Job ${jobId} cancelled successfully`);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
