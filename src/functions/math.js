import { logTime } from "../utils/timeLogger.js";
using _ = logTime("functions/math.js");

import { add } from "./basic.js";
import { three } from "../numbers.js";

export function addThree(to) {
  return add(three, to);
}

// This module is quite slow...
await new Promise(r => setTimeout(r, 1e3));
