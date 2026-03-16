import("./index.js").catch((error) => {
  console.error("Failed to load dist/index.js from CJS bridge:", error);
  process.exit(1);
});
