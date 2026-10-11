export function nowUtcIso(): string {
  return new Date().toISOString();
}

// Minutes east of UTC (e.g. +120 for UTC+2), the opposite sign of Date.getTimezoneOffset().
export function utcOffsetMin(): number {
  return -new Date().getTimezoneOffset();
}
