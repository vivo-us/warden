import { logger } from "../logging/logger";
import Warden from "../warden/index";
import fillQueue from "./fillQueue";

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
