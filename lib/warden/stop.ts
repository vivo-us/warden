import Warden from ".";
import { logger } from "../logging/logger";

export default async function stop(this: Warden) {
  try {
    clearInterval(this.processInterval);
    this.processInterval = null;
    logger.info("Warden stopped successfully");
  } catch (error) {
    logger.error("Waden encountered an error while stopping");
    throw error;
  }
}
