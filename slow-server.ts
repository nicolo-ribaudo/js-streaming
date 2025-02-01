function sleep(time: number) {
  return new Promise((r) => setTimeout(r, time));
}

class StreamThrottler implements Transformer<Uint8Array, Uint8Array> {
  constructor(bytesPerSecond: number) {
    this.#bytesPerSecond = bytesPerSecond;
    this.#lock.resolve();
  }

  #bytesPerSecond = 0;

  #queue: Array<[Uint8Array, TransformStreamDefaultController<Uint8Array>]> =
    [];

  #lock = Promise.withResolvers<void>();

  async transform(
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<Uint8Array>,
  ) {
    const oldLock = this.#lock;
    this.#lock = Promise.withResolvers();
    await oldLock;

    let start = 0;
    while (chunk.length - start > this.#bytesPerSecond) {
      controller.enqueue(
        new Uint8Array(chunk.buffer, start, this.#bytesPerSecond),
      );
      start += this.#bytesPerSecond;
      await sleep(1_000);
    }

    const lastLength = chunk.length - start;
    controller.enqueue(new Uint8Array(chunk.buffer, start, lastLength));
    await sleep(lastLength / this.#bytesPerSecond * 1000);

    this.#lock.resolve();
  }

  cancel(_reason: unknown) {
    this.#lock.reject();
  }
}

const throttler = new StreamThrottler(5_000);

Deno.serve(async (req) => {
  // !!!!!!!!!!   WARNING  !!!!!!!!!!
  // This is the most insecure server ever. Do not use where reachable from the outside.

  const { pathname } = new URL(req.url);

  const mime = pathname.endsWith(".html")
    ? "text/html"
    : pathname.endsWith(".js")
    ? "application/javascript"
    : pathname.endsWith(".jsb")
    ? "text/plain"
    : "";

  try {
    const file = await Deno.open(new URL(`.` + pathname, import.meta.url));

    return new Response(
      file.readable.pipeThrough(new TransformStream(throttler)),
      {
        status: 200,
        headers: { "Content-Type": mime },
      },
    );
  } catch (e) {
    return new Response(String(e), { status: 404 });
  }
});
