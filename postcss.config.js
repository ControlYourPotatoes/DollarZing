import autoprefixer from "autoprefixer";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let tailwindcss;
try {
  tailwindcss = require("tailwindcss");
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn(
    "[postcss] tailwindcss plugin not available; continuing without it"
  );
}

const plugins = {
  autoprefixer,
};

if (tailwindcss) {
  plugins.tailwindcss = tailwindcss;
}

export default {
  plugins,
};
