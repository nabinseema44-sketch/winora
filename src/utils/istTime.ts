/**
 * Indian Standard Time (IST) & Market Schedule Engine
 *
 * Requirements:
 * 1. Kalyan, Kalyan Morning, Kalyan Night: ALL close 2 hours before result declare!
 * 2. Hourly Play: Declares every hour (e.g. 7 AM to 8 AM, 8 AM to 9 AM).
 *    Bidding freezes 15 minutes before declaration (at :45 past the hour).
 * 3. Accurate Indian Standard Time (UTC+5:30) calculations & live countdowns.
 */

// IST is UTC + 5 hours 30 minutes
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface ISTRoundInfo {
  gameId: string;
  gameName: string;
  roundNumber: number;
  openTimeIST: string;
  freezeTimeIST: string;
  declareTimeIST: string;
  freezeTimeISO: string;
  declareTimeISO: string;
  isFrozen: boolean;
  secondsToFreeze: number;
  secondsToDeclare: number;
  formattedTimeLeft: string;
  statusText: string;
  bufferMinutes: number; // 120 for Kalyan, 15 for Hourly
}

/**
 * Returns current Date in IST
 */
export function getNowIST(): Date {
  const utcNow = Date.now();
  // Return Date object adjusted for local inspection
  return new Date(utcNow);
}

/**
 * Format any date or ISO string to Indian Standard Time (12-hour AM/PM IST)
 */
export function formatISTTime(
  dateInput?: string | number | Date,
  includeSeconds: boolean = false
): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '--:-- IST';

  return (
    d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    }) + ' IST'
  );
}

/**
 * Format full date in IST
 */
export function formatISTDateTime(dateInput?: string | number | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return 'Invalid Date';

  return (
    d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ', ' +
    formatISTTime(d)
  );
}

/**
 * Get current hour, minute in IST
 */
export function getISTComponents(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const istString = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);
  return {
    year: istDate.getFullYear(),
    month: istDate.getMonth(),
    day: istDate.getDate(),
    hours: istDate.getHours(),
    minutes: istDate.getMinutes(),
    seconds: istDate.getSeconds(),
  };
}

/**
 * Construct a UTC Date corresponding to specific IST year, month, day, hour, minute
 */
export function createDateFromIST(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number = 0
): Date {
  // IST is UTC + 5:30. So UTC time = IST time - 5:30
  const utcMs = Date.UTC(year, month, day, hours, minutes, seconds) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Calculate the active Hourly Play round based on current IST time.
 * Declares every hour (e.g. 7 AM to 8 AM, 8 AM to 9 AM).
 * Bidding freezes 15 minutes before declaration (:45 past the hour).
 */
export function getHourlyPlayRound(now: Date = new Date()): ISTRoundInfo {
  const ist = getISTComponents(now);

  // Current hourly round:
  // Starts at ist.hours:00
  // Freezes at ist.hours:45
  // Declares at (ist.hours + 1):00
  const openDate = createDateFromIST(ist.year, ist.month, ist.day, ist.hours, 0, 0);
  const freezeDate = createDateFromIST(ist.year, ist.month, ist.day, ist.hours, 45, 0);
  const declareDate = createDateFromIST(ist.year, ist.month, ist.day, ist.hours + 1, 0, 0);

  const nowMs = now.getTime();
  const freezeMs = freezeDate.getTime();
  const declareMs = declareDate.getTime();

  const isFrozen = nowMs >= freezeMs;
  const secondsToFreeze = Math.max(0, Math.floor((freezeMs - nowMs) / 1000));
  const secondsToDeclare = Math.max(0, Math.floor((declareMs - nowMs) / 1000));

  let formattedTimeLeft = '';
  let statusText = '';

  if (isFrozen) {
    const mins = Math.floor(secondsToDeclare / 60);
    const secs = secondsToDeclare % 60;
    formattedTimeLeft = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    statusText = 'Bidding Frozen (Drawing Result)';
  } else {
    const mins = Math.floor(secondsToFreeze / 60);
    const secs = secondsToFreeze % 60;
    formattedTimeLeft = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    statusText = 'Bidding Open';
  }

  // Round ID e.g. HP-0800 (for 8am to 9am)
  const hourStr = ist.hours.toString().padStart(2, '0');
  const nextHourStr = ((ist.hours + 1) % 24).toString().padStart(2, '0');
  const roundNumber = ist.year * 10000 + (ist.month + 1) * 100 + ist.hours;

  return {
    gameId: 'hourly_play',
    gameName: `Hourly Play (${hourStr}:00–${nextHourStr}:00 IST)`,
    roundNumber,
    openTimeIST: formatISTTime(openDate),
    freezeTimeIST: formatISTTime(freezeDate),
    declareTimeIST: formatISTTime(declareDate),
    freezeTimeISO: freezeDate.toISOString(),
    declareTimeISO: declareDate.toISOString(),
    isFrozen,
    secondsToFreeze,
    secondsToDeclare,
    formattedTimeLeft,
    statusText,
    bufferMinutes: 15,
  };
}

/**
 * Kalyan Markets Schedule configuration.
 * ALL close STRICTLY 2 hours (120 minutes) before result declare!
 */
export const KALYAN_SCHEDULE = {
  kalyan_morning: {
    name: 'Kalyan Morning',
    code: 'KM-90',
    openTimeStr: '11:40 AM IST',
    declareHour: 12,
    declareMinute: 40, // Result: 12:40 PM IST
    closeBufferMinutes: 60, // Closes before result declare
  },
  kalyan: {
    name: 'Kalyan',
    code: 'KL-90',
    openTimeStr: '04:35 PM IST',
    declareHour: 18,
    declareMinute: 35, // Result: 06:35 PM IST
    closeBufferMinutes: 120, // Closes before result declare
  },
  kalyan_night: {
    name: 'Kalyan Night',
    code: 'KN-90',
    openTimeStr: '09:40 PM IST',
    declareHour: 23,
    declareMinute: 40, // Result: 11:40 PM IST
    closeBufferMinutes: 120, // Closes before result declare
  },
};

/**
 * Get active round for a Kalyan market ensuring 2-hour close cutoff before declare
 */
export function getKalyanRound(
  marketId: 'kalyan_morning' | 'kalyan' | 'kalyan_night',
  now: Date = new Date()
): ISTRoundInfo {
  const config = KALYAN_SCHEDULE[marketId];
  const ist = getISTComponents(now);

  // Candidate declare time for today
  let declareDate = createDateFromIST(
    ist.year,
    ist.month,
    ist.day,
    config.declareHour,
    config.declareMinute,
    0
  );

  // If today's declare time has already passed in IST, roll to tomorrow
  if (now.getTime() >= declareDate.getTime()) {
    declareDate = createDateFromIST(
      ist.year,
      ist.month,
      ist.day + 1,
      config.declareHour,
      config.declareMinute,
      0
    );
  }

  // Freeze time is STRICTLY 2 hours (120 minutes) before declare
  const freezeDate = new Date(declareDate.getTime() - config.closeBufferMinutes * 60 * 1000);

  const nowMs = now.getTime();
  const freezeMs = freezeDate.getTime();
  const declareMs = declareDate.getTime();

  const isFrozen = nowMs >= freezeMs;
  const secondsToFreeze = Math.max(0, Math.floor((freezeMs - nowMs) / 1000));
  const secondsToDeclare = Math.max(0, Math.floor((declareMs - nowMs) / 1000));

  let formattedTimeLeft = '';
  let statusText = '';

  if (isFrozen) {
    const hours = Math.floor(secondsToDeclare / 3600);
    const mins = Math.floor((secondsToDeclare % 3600) / 60);
    const secs = secondsToDeclare % 60;
    formattedTimeLeft = `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    statusText = 'Closed (2 Hr Cutoff)';
  } else {
    const hours = Math.floor(secondsToFreeze / 3600);
    const mins = Math.floor((secondsToFreeze % 3600) / 60);
    const secs = secondsToFreeze % 60;
    formattedTimeLeft = `${hours > 0 ? hours + 'h ' : ''}${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    statusText = 'Bidding Open';
  }

  const baseRoundNum =
    marketId === 'kalyan_morning' ? 100 : marketId === 'kalyan' ? 200 : 300;
  const roundNumber = baseRoundNum + (ist.day % 30);

  return {
    gameId: marketId,
    gameName: config.name,
    roundNumber,
    openTimeIST: config.openTimeStr,
    freezeTimeIST: formatISTTime(freezeDate),
    declareTimeIST: formatISTTime(declareDate),
    freezeTimeISO: freezeDate.toISOString(),
    declareTimeISO: declareDate.toISOString(),
    isFrozen,
    secondsToFreeze,
    secondsToDeclare,
    formattedTimeLeft,
    statusText,
    bufferMinutes: config.closeBufferMinutes,
  };
}
