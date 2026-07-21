import { normalizeLongitude, type GeoPoint } from '../antipodes/geography';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
const degToRad = (degrees: number) => degrees * DEG_TO_RAD;
const radToDeg = (radians: number) => radians * RAD_TO_DEG;

export const SUNLINE_MIN_TIME_MS = Date.UTC(2000, 0, 1);
export const SUNLINE_MAX_TIME_MS = Date.UTC(2099, 11, 31, 23, 59);
export const SUNRISE_ALTITUDE_DEGREES = -0.833;

export type DaylightState = 'day' | 'civil-twilight' | 'night';
export type SolarEvents =
  | { status: 'normal'; sunriseMs: number; sunsetMs: number }
  | { status: 'polar-day'; sunriseMs: null; sunsetMs: null }
  | { status: 'polar-night'; sunriseMs: null; sunsetMs: null };

export interface SolarPosition {
  declinationDegrees: number;
  equationOfTimeMinutes: number;
  subsolarPoint: GeoPoint;
}

export interface SolarObservation {
  altitudeDegrees: number;
  daylight: DaylightState;
}

export function roundToUtcMinute(timestampMs: number): number {
  return Math.floor(timestampMs / 60_000) * 60_000;
}

export function clampSunlineTime(timestampMs: number): number {
  return clamp(
    roundToUtcMinute(timestampMs),
    SUNLINE_MIN_TIME_MS,
    SUNLINE_MAX_TIME_MS,
  );
}

export function solarPosition(timestampMs: number): SolarPosition {
  const date = new Date(timestampMs);
  const dayOfYear = getUtcDayOfYear(date);
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const yearLength = isLeapYear(date.getUTCFullYear()) ? 366 : 365;
  const gamma =
    ((2 * Math.PI) / yearLength) * (dayOfYear - 1 + (utcHours - 12) / 24);
  const equationOfTimeMinutes =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declinationRadians =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const utcMinutes = utcHours * 60;
  const subsolarLongitude = normalizeLongitude(
    (720 - utcMinutes - equationOfTimeMinutes) / 4,
  );

  return {
    declinationDegrees: radToDeg(declinationRadians),
    equationOfTimeMinutes,
    subsolarPoint: {
      latitude: radToDeg(declinationRadians),
      longitude: subsolarLongitude,
    },
  };
}

export function observeSun(
  point: GeoPoint,
  timestampMs: number,
): SolarObservation {
  const position = solarPosition(timestampMs);
  const latitude = degToRad(point.latitude);
  const declination = degToRad(position.declinationDegrees);
  const date = new Date(timestampMs);
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarMinutes = modulo(
    utcMinutes + position.equationOfTimeMinutes + 4 * point.longitude,
    1440,
  );
  const hourAngle = degToRad(trueSolarMinutes / 4 - 180);
  const sineAltitude =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const altitudeDegrees = radToDeg(Math.asin(clamp(sineAltitude, -1, 1)));

  return {
    altitudeDegrees,
    daylight:
      altitudeDegrees >= 0
        ? 'day'
        : altitudeDegrees >= -6
          ? 'civil-twilight'
          : 'night',
  };
}

export function solarEventsUtc(
  point: GeoPoint,
  timestampMs: number,
): SolarEvents {
  const date = new Date(timestampMs);
  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const noonPosition = solarPosition(utcMidnight + 12 * 60 * 60_000);
  const latitude = degToRad(point.latitude);
  const declination = degToRad(noonPosition.declinationDegrees);
  const zenith = degToRad(90 - SUNRISE_ALTITUDE_DEGREES);
  const cosineHourAngle =
    Math.cos(zenith) / (Math.cos(latitude) * Math.cos(declination)) -
    Math.tan(latitude) * Math.tan(declination);

  if (cosineHourAngle < -1) {
    return { status: 'polar-day', sunriseMs: null, sunsetMs: null };
  }
  if (cosineHourAngle > 1) {
    return { status: 'polar-night', sunriseMs: null, sunsetMs: null };
  }

  const hourAngleDegrees = radToDeg(Math.acos(cosineHourAngle));
  const solarNoonMinutes =
    720 - 4 * point.longitude - noonPosition.equationOfTimeMinutes;
  return {
    status: 'normal',
    sunriseMs: utcMidnight + (solarNoonMinutes - 4 * hourAngleDegrees) * 60_000,
    sunsetMs: utcMidnight + (solarNoonMinutes + 4 * hourAngleDegrees) * 60_000,
  };
}

export function formatSunlineTime(timestampMs: number): string {
  return `${new Date(clampSunlineTime(timestampMs)).toISOString().slice(0, 16)}Z`;
}

export function parseSunlineTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(value)) return null;
  const timestampMs = Date.parse(value);
  if (
    !Number.isFinite(timestampMs) ||
    timestampMs < SUNLINE_MIN_TIME_MS ||
    timestampMs > SUNLINE_MAX_TIME_MS ||
    formatSunlineTime(timestampMs) !== value
  ) {
    return null;
  }
  return timestampMs;
}

function getUtcDayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return Math.floor((current - start) / 86_400_000);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
