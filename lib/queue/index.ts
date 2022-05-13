import { Job as JobModel, JobStatus } from "../warden/init-db";
import { logger } from "../logging/logger";
import { emitter } from "../warden/index";
import { EventEmitter } from "events";
import { DateTime } from "luxon";
import Job from "../job/index";

export default class Queue {
  emitter: EventEmitter = emitter;
  jobsPending: number;
  jobsRunning: number;
  queue: Array<Job>;
  constructor() {
    this.jobsPending = 0;
    this.jobsRunning = 0;
    this.queue = [];
    this.emitter.addListener("remove-job", (job) => this.remove(job.id));
    this.emitter.addListener("job-updated", () => this.sort());
    this.emitter.addListener("job-added", () => this.sort());
  }

  sort() {
    try {
      this.queue = this.queue.sort((a, b) => {
        let score = 0;
        if (a.nextRunAt && b.nextRunAt) {
          if (a.nextRunAt.valueOf() < b.nextRunAt.valueOf()) score -= 1;
          else score += 1;
        } else if (a.nextRunAt) score -= 1;
        else if (b.nextRunAt) score += 1;
        if (a.timeout && b.timeout) {
          if (a.timeout < b.timeout) score -= 2;
          else score += 2;
        } else if (a.timeout) score -= 2;
        else if (b.timeout) score += 2;
        return score;
      });
      interface FoundJob {
        [key: string]: boolean;
      }
      let foundJob: FoundJob = {};
      for (let each of this.queue) {
        if (each.name in foundJob) continue;
        else foundJob[each.name] = true;
      }
      return Object.keys(foundJob);
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }

  add(job: Job) {
    try {
      this.queue.push(job);
      this.jobsPending++;
      logger.debug(`${job.name} ${job.id} added to queue`);
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }

  async cancel(jobId: number) {
    try {
      let index = this.queue.findIndex((job) => job.id === jobId);
      if (index === -1)
        throw new Error(`Job ${jobId} not found for cancellation`);
      if (this.queue[index].timeout) clearTimeout(this.queue[index].timeout);
      this.queue.splice(index, 1);
      await JobModel.update(
        { status: JobStatus.Cancelled, nextRunAt: null },
        { where: { jobId } }
      );
      this.jobsPending--;
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }

  remove(jobId: number) {
    let index = this.queue.findIndex((each) => each.id === jobId);
    if (index === -1) throw new Error(`Job ${jobId} not found for removal`);
    this.queue.splice(index, 1);
    this.jobsPending--;
    logger.debug(`${jobId} removed from queue`);
  }

  getNextJob(jobName: string): Job | undefined {
    try {
      for (let job of this.queue) {
        if (
          !job.nextRunAt ||
          job.name !== jobName ||
          job.status === JobStatus.Running
        )
          continue;
        if (job.timeout) return undefined;
        let diff = job.nextRunAt.diff(DateTime.now(), "milliseconds").valueOf();
        if (diff <= 0) {
          job.status = JobStatus.Running;
          return job;
        }
        logger.debug(`${job.name} ${job.id} delayed by ${diff / 1000}s`);
        job.timeout = setTimeout(() => {
          job.timeout = null;
          this.emitter.emit("job-ready", job.name);
        }, diff);
        return undefined;
      }
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }
}
