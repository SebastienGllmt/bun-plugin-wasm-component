import myPlugin from "./loader/component.ts";

const result = await Bun.build({
  entrypoints: ["./main.ts"],
  outdir: "./dist",
  sourcemap: "external",
  target: "bun",
  plugins: [myPlugin],
});

if (result.success) {
  // Run the built file
  const proc = Bun.spawn(["bun", "./dist/main.js"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;
} else {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

