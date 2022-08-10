import { JobOutput, Job as JobModel, JobStatus } from "./init-db";
import Job, { JobConfig } from "../job/index";
import { logger } from "../logging/logger";
import Warden from "../warden/index";
import { DateTime } from "luxon";
import { Op } from "sequelize";

export default async function fillQueue(this: Warden, context: string) {
  logger.debug(`Starting to fill queue for ${context}`);
  let self = this;
  let fetchList = [];
  for (let each in this.processes) fetchList.push(fetchJobs(each));
  await Promise.allSettled(fetchList);
  let jobsToRun = this.queue.sort();
  this.nextScan = DateTime.now().plus({ milliseconds: this.frequency });
  if (this.queue.queue.length > 0) this.emitter.emit("queue-filled", jobsToRun);

  async function fetchJobs(jobName: string) {
    try {
      let process = self.processes[jobName];
      let { lockLifetime } = process;
      let nextRun = DateTime.now().plus({ milliseconds: self.frequency });
      let lockExpiration = DateTime.now().minus({ milliseconds: lockLifetime });
      let pendingJobs: Array<JobOutput> = await JobModel.findAll({
        where: {
          name: jobName,
          [Op.and]: [
            { status: { [Op.ne]: JobStatus.Cancelled } },
            { status: { [Op.ne]: JobStatus.Done } },
            { status: { [Op.ne]: JobStatus.Failed } },
          ],
          [Op.or]: [
            {
              lockedAt: null,
              nextRunAt: { [Op.lte]: nextRun.toJSDate() },
            },
            { lockedAt: { [Op.lte]: lockExpiration.toJSDate() } },
          ],
        },
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["nextRunAt", "ASC"]],
        raw: true,
      });
      if (!pendingJobs || pendingJobs.length === 0) return;
      for (let each of pendingJobs) {
        let jobConfig: JobConfig = {
          id: each.jobId,
          name: each.name,
          recurrance: each.recurrance,
          timezone: self.timezone,
          data: each.data,
          status: each.status,
          numberOfRetries: each.numberOfRetries,
          nextRunAt: each.nextRunAt,
          lockedAt: each.lockedAt,
        };
        let job = new Job(jobConfig, self.processes[each.name]);
        let found = false;
        for (let job of self.queue.queue) {
          if (job.id !== each.jobId) continue;
          found = true;
          break;
        }
        if (found) continue;
        self.queue.add(job);
        if (job.status !== JobStatus.Pending) {
          if (job.status === JobStatus.Retry) job.numberOfRetries += 1;
          job.status = JobStatus.Pending;
          await JobModel.update(
            { status: JobStatus.Pending, numberOfRetries: job.numberOfRetries },
            { where: { jobId: job.id } }
          );
        }
        if (job.lockedAt) {
          job.lockedAt = null;
          await JobModel.update(
            { lockedAt: null },
            { where: { jobId: job.id } }
          );
        }
      }
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }
}
