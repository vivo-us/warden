import { logger } from "../logging/logger";
import Warden from ".";

export default function distribute(this: Warden) {
  try {
    if (this.distributing) return;
    this.distributing = true;
    let more = true;
    while (more) {
      let array = this.processesToDistribute.shift();
      if (!array) break;
      let length = this.queue.queue.length;
      if (length === 0) break;
      for (let each in this.processes) {
        if (!array.includes(each)) continue;
        let freeWorkers = true;
        while (freeWorkers) {
          let freeWorker = this.processes[each].getNextFreeWorker();
          if (freeWorker === null) break;
          let job = this.queue.getNextJob(each);
          if (!job) break;
          this.emitter.emit("assigned", {
            nextScan: this.nextScan,
            job,
            processName: each,
            workerId: freeWorker,
          });
        }
      }
    }
    this.distributing = false;
  } catch (error: any) {
    logger.error(error.message);
    throw error;
  }
}
