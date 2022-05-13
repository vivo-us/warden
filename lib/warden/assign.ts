import { Process } from "./../processes/index";
import Warden from "./index";

export default function assign(this: Warden, process: Process) {
  if (!this.processInterval) throw new Error("Warden not initiated.");
  this.processes[process.name] = process;
}
