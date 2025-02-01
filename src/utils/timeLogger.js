using _ = logTime("utils/timeLogger.js");

export function logTime(name) {
  const start = performance.now();
  console.info(`Start ${name}`);

  return {
    [Symbol.dispose]() {
      console.info(`End ${name} (took ${performance.now() - start}ms)`)
    }
  }
}
