import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as buildApplication } from "fastify-cli/helper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AppPath = path.join(__dirname, "..", "index.js");

// Fill in this config with all the configurations needed for testing the application.
function config() {
  return {
    skipOverride: true,
  };
}

// Automatically build and tear down our instance.
async function build(t) {
  const argv = [AppPath];
  const app = await buildApplication(argv, config());

  t.after(() => app.close());

  return app;
}

export { config, build };
