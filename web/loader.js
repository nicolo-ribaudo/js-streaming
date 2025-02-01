/** @param {URL} url */
export async function loadBundle(url, { streamingExecution }) {
  const result = await fetch(url);

  const modulesStream = new UnbudlerStream(result.body);

  let last;

  for await (const { specifier, source } of modulesStream) {
    const fullSpecifier = `bundle://${specifier}`;

    const script = document.createElement("script");
    script.setAttribute("type", "importmap");
    script.textContent = JSON.stringify({
      imports: {
        [fullSpecifier]: `data:text/javascript,${encodeURIComponent(source + "\n//# sourceURL=" + specifier)}`
      }
    });
    document.head.appendChild(script);

    if (streamingExecution) {
      last = import(fullSpecifier);
    } else {
      last = fullSpecifier;
    }
  }

  if (streamingExecution) {
    return last;
  } else {
    return import(last);
  }
}

/**
 * @extends {ReadableStream<{ specifier: string, source: string }>}
 */
export class UnbudlerStream extends ReadableStream {

  /** @param {ReadableStream<Uint8Array>} bundleStream */
  constructor(bundleStream) {
    const decoder = new TextDecoder();
    const bundleReader = bundleStream.getReader({ mode: "byob" });
    let lengthBuffer = new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT);
    let specifierBuffer = new ArrayBuffer(2 ** 10 /* 1 kB */);
    let sourceBuffer = new ArrayBuffer(2 ** 14 /* 16kB */);

    let done = false;

    /** @param {ArrayBuffer} buffer */
    const readUint32 = async () => {
      const res = await bundleReader.read(
        new Uint8Array(lengthBuffer, 0, Uint32Array.BYTES_PER_ELEMENT),
        // min does not actually work in Chrome, but let's pretend that it
        // does because it makes everything simpler. In practice we'd be
        // very unlucky if we the chunking happens exactly in the middle of
        // these bytes.
        // If anything related to computing lenghts breaks in very weird
        // ways, make this code not rely on a non-working min option anymore.
        { min: Uint32Array.BYTES_PER_ELEMENT },
      );
      if (res.done) {
        done = true;
        return 0;
      }

      lengthBuffer = res.value.buffer;
      return new Uint32Array(lengthBuffer, 0, 1)[0];
    };

    const readString = async (buffer, length) => {;
      let string = "";
      let i = 0;
      while (i < length) {
        const res = await bundleReader.read(
          new Uint8Array(buffer, 0, Math.min(buffer.byteLength, length - i)),
        );
        if (res.done) {
          done = true;
          return { buffer, string: "" };
        }

        const resLength = res.value.byteLength;
        i += resLength;
        string += decoder.decode(res.value, { stream: i <= length });
        buffer = res.value.buffer;
      }

      return { buffer, string };
    };

    super({
      async pull(controller) {
        const specifierLength = await readUint32();
        if (done) return controller.close();

        const sourceLength = await readUint32();
        if (done) return controller.error();

        let specifier;
        ({ buffer: specifierBuffer, string: specifier } = await readString(
          specifierBuffer,
          specifierLength,
        ));
        if (done) return controller.error();

        let source;
        ({ buffer: sourceBuffer, string: source } = await readString(
          sourceBuffer,
          sourceLength,
        ));
        if (done) return controller.error();

        controller.enqueue({ specifier, source });
      },
    });
  }
}
