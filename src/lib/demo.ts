export function demoMode() {
  return process.env.DEMO_MODE === "1" &&
    (process.env.NODE_ENV !== "production" || process.env.APP_ENV === "staging");
}
