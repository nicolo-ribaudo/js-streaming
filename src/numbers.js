import { logTime } from "./utils/timeLogger.js";
using _ = logTime("numbers.js");

export const one = 1;
export const three = 3;

// This module is quite slow...
await new Promise(r => setTimeout(r, 1e3));
