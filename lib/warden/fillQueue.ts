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
  this.nextScan = DateTime.now().plus({ milliseconds: this.frequency });
  this.queue.nextRunAt = this.nextScan;
  await Promise.allSettled(fetchList);
  let jobsToRun = await this.queue.sort();
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
        let existingJob = self.queue.queue.find(
          (job) => Number(job.id) === Number(each.jobId)
        );
        if (existingJob) {
          if (existingJob.status === JobStatus.Running) {
            logger.debug(
              `Job ${existingJob.id} is already running. Will update for next run.`
            );
          }
          if (existingJob.status !== each.status) {
            existingJob.status = each.status;
          }
          if (existingJob.recurrance !== each.recurrance) {
            existingJob.recurrance = each.recurrance;
          }
          if (existingJob.data !== each.data) {
            existingJob.data = each.data;
          }
          if (existingJob.numberOfRetries !== each.numberOfRetries) {
            existingJob.numberOfRetries = each.numberOfRetries;
          }
          if (existingJob.nextRunAt !== each.nextRunAt) {
            if (each.nextRunAt) {
              existingJob.nextRunAt = DateTime.fromJSDate(each.nextRunAt);
            } else {
              existingJob.nextRunAt = null;
            }
          }
          if (existingJob.lockedAt !== each.lockedAt) {
            if (each.lockedAt) {
              existingJob.lockedAt = DateTime.fromJSDate(each.lockedAt);
            } else {
              existingJob.lockedAt = null;
            }
          }
          let jobIndex = self.queue.queue.indexOf(existingJob);
          if (jobIndex !== -1) self.queue.queue[jobIndex] = existingJob;
        } else {
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
          let newJob = new Job(jobConfig, self.processes[each.name]);
          self.queue.add(newJob);
          if (newJob.status !== JobStatus.Pending) {
            newJob.status = JobStatus.Pending;
            await JobModel.update(
              { status: JobStatus.Pending },
              { where: { jobId: newJob.id } }
            );
          }
          if (newJob.lockedAt) {
            newJob.lockedAt = null;
            await JobModel.update(
              { lockedAt: null },
              { where: { jobId: newJob.id } }
            );
          }
        }
      }

      // Removes any jobs that are no longer in the queue in the db

      let jobIdList = pendingJobs.map((job) => Number(job.jobId));
      for (let each of self.queue.queue) {
        if (each.process.name !== process.name || jobIdList.includes(each.id))
          continue;
        await self.queue.remove(each.id, "No longer in the database queue");
      }
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }
}
