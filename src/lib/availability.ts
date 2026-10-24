export type Window = { start: Date; end: Date };
export type Block = Window & { kind?: string };
export function buffered(window: Window, days: number): Window {
  if (!Number.isInteger(days) || days < 0 || window.start >= window.end)
    throw new Error("INVALID_WINDOW");
  const ms = days * 86_400_000;
  return { start: new Date(window.start.getTime() - ms), end: new Date(window.end.getTime() + ms) };
}
export function overlaps(a: Window, b: Window) {
  return a.start < b.end && b.start < a.end;
}
export function available(blocks: Block[], window: Window, bufferDays: number) {
  const requested = buffered(window, bufferDays);
  return !blocks.some(block => overlaps(requested, block));
}
export function availabilityLabel(free: number, threshold: number) {
  return free === 0 ? "unavailable" : free < threshold ? "limited" : "free";
}

// Convert wall-clock input in the selected district to UTC, rejecting skipped/ambiguous DST times.
export function localToUtc(local: string, timezone: string) {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(local);
  if (!match) throw new Error("INVALID_LOCAL_DATE");
  const [, y, mo, day, hour, minute] = match;
  const target = `${y}-${mo}-${day} ${hour}:${minute}`;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  const naive = Date.UTC(+y, +mo - 1, +day, +hour, +minute);
  const matches: Date[] = [];
  // 15-minute offsets cover modern timezone transitions without assuming a district offset.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(naive - offset * 60_000);
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map(p => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}` === target)
      matches.push(candidate);
  }
  if (matches.length !== 1) throw new Error(matches.length ? "AMBIGUOUS_LOCAL_DATE" : "NONEXISTENT_LOCAL_DATE");
  return matches[0];
}
