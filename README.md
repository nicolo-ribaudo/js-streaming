# Streaming execution of JS bundles

> All credits for the idea and approach go to [Yoav Weiss](https://github.com/yoavweiss).

## Instructions

- The JS files are in the `src` folder. When changing them, run `deno task bundle` to re-generate the bundles.
- `./slow-server.ts` is a server that simulates a slow connection, by serving only up to 5KB per second. You can run it with `deno task server`.
  - You can use any other server, but make sure to serve the root of this repo.
- Open `http://localhost:8000/web/index.html` in Chrome Canary, or any other browser that supports dynamic import maps
- Look at the logs in the console, and how they relate to the bundle loading in the network panel!

In `index.html`, you can comment/uncomment the various loading approaches:
- using the custom bundle format, and streaming the execution of the modules as they come
- using the custom bundle format, but waiting for it to be fully loaded before executing
- using the native ESM loader, without bundling
- using the native ESM loader, with an esbuild bundle

Some of the JS files contain top-level awaits that just sleep for 1 second. This is obviously unrelaistic, but they are meant to exagerate the effect of module execution time.

## Bundle format

The bundler for this format is deined in `./bundler.ts`. It sorts the modules in the graph in the order that they are meant to be executed. Each module is represented as:
- a `uint32` containing the length of the module specifier, in bytes
- the module specifier, encoded as UTF-8
- a `uint32` containing the length of the module source, in bytes
- the module source, encoded as UTF-8
And multiple module are, once encoded as above, simply concatenated.

The generates `web/bundle.jsb` is technically not a UTF-8 file (due to the various `uint32`s), but it's enough UTF-8 that you can probably open it in a text editor.
