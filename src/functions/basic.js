import { logTime } from "../utils/timeLogger.js";
using _ = logTime("functions/basic.js");

export function add(x, y) {
  return x + y;
}
