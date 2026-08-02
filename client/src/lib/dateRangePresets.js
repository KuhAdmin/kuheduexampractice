// India has no DST, so a fixed +05:30 offset is all that's needed here --
// no timezone library required. "Today"/"this week"/"this month" always
// mean the IST calendar day/week/month, regardless of where the browser or
// server happen to be running.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const istMidnightUtc = (year, month, day) => new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);

const istEndOfDayUtc = (year, month, day) => new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);

// Shifts "now" so its getUTC* fields read as today's IST wall-clock date --
// only ever used to find which IST calendar day "now" falls on, never to
// build a real instant directly (that's what istMidnightUtc/istEndOfDayUtc
// above are for).
const nowAsIstWallClock = () => new Date(Date.now() + IST_OFFSET_MS);

const istDateParts = (wallClockDate) => ({
  year: wallClockDate.getUTCFullYear(),
  month: wallClockDate.getUTCMonth(),
  day: wallClockDate.getUTCDate(),
});

export const todayRange = () => {
  const { year, month, day } = istDateParts(nowAsIstWallClock());
  return { dateFrom: istMidnightUtc(year, month, day).toISOString(), dateTo: new Date().toISOString() };
};

export const last3DaysRange = () => {
  const { year, month, day } = istDateParts(nowAsIstWallClock());
  return { dateFrom: istMidnightUtc(year, month, day - 2).toISOString(), dateTo: new Date().toISOString() };
};

export const thisWeekRange = () => {
  const wallClock = nowAsIstWallClock();
  const { year, month, day } = istDateParts(wallClock);
  const weekday = wallClock.getUTCDay(); // 0=Sun..6=Sat, read off the IST-shifted instant
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return {
    dateFrom: istMidnightUtc(year, month, day - daysSinceMonday).toISOString(),
    dateTo: new Date().toISOString(),
  };
};

export const thisMonthRange = () => {
  const { year, month } = istDateParts(nowAsIstWallClock());
  return { dateFrom: istMidnightUtc(year, month, 1).toISOString(), dateTo: new Date().toISOString() };
};

const parseIsoDateParts = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month - 1, day };
};

// fromValue/toValue: "YYYY-MM-DD" from <input type="date"> -- interpreted as
// IST calendar dates regardless of the browser's own local timezone.
export const customRange = (fromValue, toValue) => {
  let dateFrom;
  let dateTo;

  if (fromValue) {
    const { year, month, day } = parseIsoDateParts(fromValue);
    dateFrom = istMidnightUtc(year, month, day).toISOString();
  }

  if (toValue) {
    const { year, month, day } = parseIsoDateParts(toValue);
    dateTo = istEndOfDayUtc(year, month, day).toISOString();
  }

  return { dateFrom, dateTo };
};

export const DATE_RANGE_PRESETS = [
  { key: "today", label: "Today", getRange: todayRange },
  { key: "last3days", label: "Last 3 days", getRange: last3DaysRange },
  { key: "thisWeek", label: "This week", getRange: thisWeekRange },
  { key: "thisMonth", label: "This month", getRange: thisMonthRange },
  { key: "custom", label: "Custom", getRange: null },
];
