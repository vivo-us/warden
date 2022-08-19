import { JobStatus } from "../warden/init-db";
import { logger } from "../logging/logger";
import { emitter } from "../warden/index";
import { EventEmitter } from "events";
import { DateTime } from "luxon";
import Job from "../job/index";

interface QueueData {
  frequency: number;
  nextRunAt: DateTime;
}

export default class Queue {
  frequency: number;
  nextRunAt: DateTime;
  emitter: EventEmitter = emitter;
  jobsPending: number;
  jobsRunning: number;
  queue: Array<Job>;
  constructor(data: QueueData) {
    this.frequency = data.frequency;
    this.nextRunAt = data.nextRunAt;
    this.jobsPending = 0;
    this.jobsRunning = 0;
    this.queue = [];
    this.emitter.addListener("remove-job", (job) => this.remove(job.id));
    this.emitter.addListener("job-updated", this.handleQueueChange);
    this.emitter.addListener("job-added", this.handleQueueChange);
  }

  handleQueueChange = async () => {
    let jobsToRun = await this.sort();
    this.emitter.emit("queue-updated", jobsToRun);
  };

  async sort() {
    for (let each of this.queue) {
      if (each.nextRunAt) {
        if (each.nextRunAt.toJSDate() <= this.nextRunAt.toJSDate()) continue;
        await this.remove(
          each.id,
          "Job will run after the next scan. Will fetch once closer to run time."
        );
        continue;
      }
      if (each.timeout) {
        let timeoutTime = each.timeout._idleStart + each.timeout._idleTimeout;
        if (timeoutTime <= this.nextRunAt.toJSDate()) continue;
        await this.remove(
          each.id,
          "Job will run after the next scan. Will fetch once closer to run time."
        );
        continue;
      }
    }
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

  update(job: Job) {
    try {
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].id !== job.id) continue;
        if (this.queue[i].timeout) clearTimeout(this.queue[i].timeout);
        this.queue[i] = job;
        logger.debug(`${job.name} ${job.id} updated in queue`);
        return;
      }
      this.queue.push(job);
      this.jobsPending++;
      logger.debug(`${job.name} ${job.id} added to queue`);
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }

  async remove(jobId: number, reason?: string) {
    let index = this.queue.findIndex((each) => each.id === jobId);
    if (index === -1) return;
    this.queue.splice(index, 1);
    this.jobsPending--;
    logger.debug(`${jobId} removed from queue. ${reason ? reason : ""}`);
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

  clear() {
    try {
      for (let job of this.queue) {
        if (job.timeout) clearTimeout(job.timeout);
      }
      this.queue = [];
    } catch (error: any) {
      logger.error(error.message);
      throw error;
    }
  }
}
