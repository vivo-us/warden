import Warden from ".";
import fillQueue from "./fillQueue";
import { logger } from "../logging/logger";

interface Options {
  frequency?: number;
}

export default async function start(this: Warden, options?: Options) {
  if (!this.initiated) {
    throw new Error(
      "Warden has not been initiated. Please call .init() first."
    );
  }
  if (options?.frequency) this.frequency = options.frequency;
  this.processInterval = setInterval(
    fillQueue.bind(this, "start-interval"),
    this.frequency
  );
  process.nextTick(fillQueue.bind(this, "start"));
  logger.info("Warden started successfully");
}

// Need to figure out why the second iteration of fetching jobs will not force run. For some reasont the queue-filled event is being fired early.
