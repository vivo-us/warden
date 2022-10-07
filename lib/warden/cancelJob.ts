import { logger } from "../logging/logger";
import Warden from "./index";
import { Job, JobStatus } from "./init-db";

export default async function cancel(this: Warden, jobId: number) {
  try {
    this.queue.remove(jobId);
    let [rowsAffected] = await Job.update(
      { nextRunAt: null, status: JobStatus.Cancelled },
      { where: { jobId } }
    );
    if (rowsAffected === 0) {
      throw new Error(`Job ${jobId} not found for cancellation.`);
    }
    logger.debug(`Job ${jobId} cancelled successfully`);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
