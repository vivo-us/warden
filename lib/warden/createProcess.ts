import { Process, ProcessOptions } from "../processes/index";
import { logger } from "../logging/logger";
import Warden from "../warden/index";

export default function createProcess(
  this: Warden,
  name: string,
  func: () => any,
  options?: ProcessOptions
) {
  try {
    let process = new Process(name, func, options);
    this.processes[name] = process;
    return process;
  } catch (error: any) {
    logger.error(error.message);
    throw error;
  }
}
