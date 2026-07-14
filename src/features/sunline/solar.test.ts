import { describe, expect, it } from 'vitest';
import {
  formatSunlineTime,
  observeSun,
  parseSunlineTime,
  solarEventsUtc,
  solarPosition,
} from './solar';

describe('Sunline solar calculations', () => {
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
