// Builds the plugin into dist/:
//   dist/code.js  main thread bundle (Figma sandbox)
//   dist/ui.html  single HTML file with inlined CSS and JS (Figma iframe)
import { build, context } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const watch = process.argv.includes("--watch");
const outDir = "dist";
mkdirSync(outDir, { recursive: true });

const codeOptions = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: join(outDir, "code.js"),
  target: "es2017",
  format: "iife",
  logLevel: "info",
};

const uiOptions = {
  entryPoints: ["src/ui/main.tsx"],
  bundle: true,
  write: false,
  target: "es2020",
  format: "iife",
  minify: !watch,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": watch ? '"development"' : '"production"' },
  logLevel: "info",
};

function buildCss() {
  const tailwindBin = join(dirname(require.resolve("tailwindcss/package.json")), "lib", "cli.js");
  return execFileSync(
    process.execPath,
    [tailwindBin, "-c", "tailwind.config.cjs", "-i", "src/ui/styles.css", "--minify"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
}

function writeHtml(js) {
  const template = readFileSync("src/ui/index.html", "utf8");
  const css = buildCss();
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  const html = template
    .replace("/*__CSS__*/", () => css)
    .replace("/*__JS__*/", () => safeJs);
  writeFileSync(join(outDir, "ui.html"), html);
  console.log(`ui.html written (${(html.length / 1024).toFixed(1)} KB)`);
}

async function buildUi() {
  const result = await build(uiOptions);
  writeHtml(result.outputFiles[0].text);
}

if (watch) {
  const codeCtx = await context(codeOptions);
  await codeCtx.watch();
  const uiCtx = await context({
    ...uiOptions,
    plugins: [
      {
        name: "inline-html",
        setup(b) {
          b.onEnd((result) => {
            if (result.errors.length === 0 && result.outputFiles) {
              writeHtml(result.outputFiles[0].text);
            }
          });
        },
      },
    ],
  });
  await uiCtx.watch();
  console.log("Watching for changes...");
} else {
  await build(codeOptions);
  await buildUi();
}
