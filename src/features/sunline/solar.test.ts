import { describe, expect, it } from 'vitest';
import { MathUtils } from 'three';
import {
  formatSunlineTime,
  observeSun,
  parseSunlineTime,
  solarEventsUtc,
  solarPosition,
} from './solar';

describe('Sunline solar calculations', () => {
  it.each([
    {
      point: { latitude: 31.2304, longitude: 121.4737 },
      timestamp: Date.parse('2026-07-21T09:37:23Z'),
    },
    {
      point: { latitude: 0, longitude: 0 },
      timestamp: Date.parse('2024-03-20T12:00:00Z'),
    },
    {
      point: { latitude: 80, longitude: 0 },
      timestamp: Date.parse('2024-12-21T12:00:00Z'),
    },
  ])(
    'matches the prior Three MathUtils formulas exactly at $timestamp',
    ({ point, timestamp }) => {
      const position = solarPosition(timestamp);
      const observation = observeSun(point, timestamp);
      const events = solarEventsUtc(point, timestamp);
      const legacy = legacySolarResult(point, timestamp);

      expect(position).toEqual(legacy.position);
      expect(observation).toEqual(legacy.observation);
      expect(events).toEqual(legacy.events);
    },
  );

  it('places the subsolar point near the equator at the March equinox', () => {
    const result = solarPosition(Date.parse('2024-03-20T12:00:00Z'));
    expect(Math.abs(result.subsolarPoint.latitude)).toBeLessThan(0.6);
    expect(result.subsolarPoint.longitude).toBeCloseTo(1.8, 0);
  });

  it('tracks the northern tropic near the June solstice', () => {
    const result = solarPosition(Date.parse('2024-06-20T20:51:00Z'));
    expect(result.subsolarPoint.latitude).toBeCloseTo(23.45, 0);
  });

  it('tracks the southern tropic near the December solstice', () => {
    const result = solarPosition(Date.parse('2024-12-21T09:21:00Z'));
    expect(result.subsolarPoint.latitude).toBeCloseTo(-23.44, 0);
  });

  it('wraps the subsolar longitude across the UTC date boundary', () => {
    const longitudes = Array.from(
      { length: 121 },
      (_, minute) =>
        solarPosition(Date.parse('2024-03-20T23:00:00Z') + minute * 60_000)
          .subsolarPoint.longitude,
    );
    const crossing = longitudes.findIndex(
      (longitude, index) =>
        index > 0 && Math.abs(longitude - longitudes[index - 1]!) > 350,
    );
    expect(crossing).toBeGreaterThan(0);
    const before = longitudes[crossing - 1]!;
    const after = longitudes[crossing]!;
    expect(Math.abs(Math.abs(before) - 180)).toBeLessThan(1);
    expect(Math.abs(Math.abs(after) - 180)).toBeLessThan(1);
  });

  it('classifies day, twilight, and night from solar altitude', () => {
    const noon = observeSun(
      { latitude: 0, longitude: 0 },
      Date.parse('2024-03-20T12:00:00Z'),
    );
    const midnight = observeSun(
      { latitude: 0, longitude: 0 },
      Date.parse('2024-03-20T00:00:00Z'),
    );
    expect(noon.daylight).toBe('day');
    expect(noon.altitudeDegrees).toBeGreaterThan(88);
    expect(midnight.daylight).toBe('night');
  });

  it('approximates NOAA equatorial sunrise and sunset within five minutes', () => {
    const events = solarEventsUtc(
      { latitude: 0, longitude: 0 },
      Date.parse('2024-03-20T12:00:00Z'),
    );
    expect(events.status).toBe('normal');
    if (events.status !== 'normal') return;
    expect(new Date(events.sunriseMs).toISOString().slice(11, 16)).toBe(
      '06:04',
    );
    expect(new Date(events.sunsetMs).toISOString().slice(11, 16)).toBe('18:11');
  });

  it('approximates a regular mid-latitude sunrise and sunset', () => {
    const events = solarEventsUtc(
      { latitude: 40.7128, longitude: -74.006 },
      Date.parse('2024-06-20T12:00:00Z'),
    );
    expect(events.status).toBe('normal');
    if (events.status !== 'normal') return;
    expect(minutesUtc(events.sunriseMs)).toBeGreaterThanOrEqual(9 * 60 + 20);
    expect(minutesUtc(events.sunriseMs)).toBeLessThanOrEqual(9 * 60 + 30);
    expect(minutesUtc(events.sunsetMs)).toBeGreaterThanOrEqual(26);
    expect(minutesUtc(events.sunsetMs)).toBeLessThanOrEqual(36);
  });

  it('reports polar day and polar night instead of fabricated events', () => {
    expect(
      solarEventsUtc(
        { latitude: 80, longitude: 0 },
        Date.parse('2024-06-20T12:00:00Z'),
      ).status,
    ).toBe('polar-day');
    expect(
      solarEventsUtc(
        { latitude: 80, longitude: 0 },
        Date.parse('2024-12-21T12:00:00Z'),
      ).status,
    ).toBe('polar-night');
    expect(
      solarEventsUtc(
        { latitude: -80, longitude: 0 },
        Date.parse('2024-12-21T12:00:00Z'),
      ).status,
    ).toBe('polar-day');
  });

  it('round-trips bounded minute-precision UTC values', () => {
    const timestamp = Date.parse('2026-07-14T09:37:00Z');
    expect(parseSunlineTime(formatSunlineTime(timestamp))).toBe(timestamp);
    expect(parseSunlineTime('1999-12-31T23:59Z')).toBeNull();
    expect(parseSunlineTime('2026-02-30T12:00Z')).toBeNull();
  });
});

function minutesUtc(timestampMs: number): number {
  const date = new Date(timestampMs);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function legacySolarResult(
  point: { latitude: number; longitude: number },
  timestampMs: number,
) {
  const date = new Date(timestampMs);
  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  function positionAt(value: number) {
    const current = new Date(value);
    const start = Date.UTC(current.getUTCFullYear(), 0, 0);
    const day = Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    );
    const dayOfYear = Math.floor((day - start) / 86_400_000);
    const utcHours =
      current.getUTCHours() +
      current.getUTCMinutes() / 60 +
      current.getUTCSeconds() / 3600;
    const year = current.getUTCFullYear();
    const yearLength =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
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
    const longitude =
      (((((720 - utcHours * 60 - equationOfTimeMinutes) / 4 + 180) % 360) +
        360) %
        360) -
      180;
    return {
      declinationDegrees: MathUtils.radToDeg(declinationRadians),
      equationOfTimeMinutes,
      subsolarPoint: {
        latitude: MathUtils.radToDeg(declinationRadians),
        longitude: Object.is(longitude, -0) ? 0 : longitude,
      },
    };
  }

  const position = positionAt(timestampMs);
  const latitude = MathUtils.degToRad(point.latitude);
  const declination = MathUtils.degToRad(position.declinationDegrees);
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarMinutes =
    (((utcMinutes + position.equationOfTimeMinutes + 4 * point.longitude) %
      1440) +
      1440) %
    1440;
  const hourAngle = MathUtils.degToRad(trueSolarMinutes / 4 - 180);
  const sineAltitude =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const altitudeDegrees = MathUtils.radToDeg(
    Math.asin(MathUtils.clamp(sineAltitude, -1, 1)),
  );
  const observation = {
    altitudeDegrees,
    daylight:
      altitudeDegrees >= 0
        ? ('day' as const)
        : altitudeDegrees >= -6
          ? ('civil-twilight' as const)
          : ('night' as const),
  };

  const noonPosition = positionAt(utcMidnight + 12 * 60 * 60_000);
  const noonDeclination = MathUtils.degToRad(noonPosition.declinationDegrees);
  const zenith = MathUtils.degToRad(90.833);
  const cosineHourAngle =
    Math.cos(zenith) / (Math.cos(latitude) * Math.cos(noonDeclination)) -
    Math.tan(latitude) * Math.tan(noonDeclination);
  const events =
    cosineHourAngle < -1
      ? ({ status: 'polar-day', sunriseMs: null, sunsetMs: null } as const)
      : cosineHourAngle > 1
        ? ({ status: 'polar-night', sunriseMs: null, sunsetMs: null } as const)
        : (() => {
            const hourAngleDegrees = MathUtils.radToDeg(
              Math.acos(cosineHourAngle),
            );
            const solarNoonMinutes =
              720 - 4 * point.longitude - noonPosition.equationOfTimeMinutes;
            return {
              status: 'normal' as const,
              sunriseMs:
                utcMidnight +
                (solarNoonMinutes - 4 * hourAngleDegrees) * 60_000,
              sunsetMs:
                utcMidnight +
                (solarNoonMinutes + 4 * hourAngleDegrees) * 60_000,
            };
          })();

  return { position, observation, events };
}
