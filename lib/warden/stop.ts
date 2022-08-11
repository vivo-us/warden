import { logger } from "../logging/logger";
import Warden from "../warden/index";

export default async function stop(this: Warden) {
  try {
    clearInterval(this.processInterval);
    this.processing = false;
    logger.info("Warden stopped successfully");
  } catch (error) {
    logger.error("Waden encountered an error while stopping");
    throw error;
  }
}
