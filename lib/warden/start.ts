import { logger } from "../logging/logger";
import Warden from "../warden/index";
import fillQueue from "./fillQueue";

interface Options {
  frequency?: number;
}

export default async function start(this: Warden, options?: Options) {
  await this.initiated;
  if (options?.frequency) this.frequency = options.frequency;
  this.processInterval = setInterval(
    fillQueue.bind(this, "start-interval"),
    this.frequency
  );
  process.nextTick(fillQueue.bind(this, "start"));
  logger.info("Warden started successfully");
}
