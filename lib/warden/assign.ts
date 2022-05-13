import { logger } from "./../logging/logger";
import { Process } from "./../processes/index";
import Warden from "./index";

export default function assign(this: Warden, process: Process) {
  this.processes[process.name] = process;
  logger.debug(`Process ${process.name} assigned to Warden`);
}
