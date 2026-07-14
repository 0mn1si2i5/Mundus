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
  });

  it('round-trips bounded minute-precision UTC values', () => {
    const timestamp = Date.parse('2026-07-14T09:37:00Z');
    expect(parseSunlineTime(formatSunlineTime(timestamp))).toBe(timestamp);
    expect(parseSunlineTime('1999-12-31T23:59Z')).toBeNull();
    expect(parseSunlineTime('2026-02-30T12:00Z')).toBeNull();
  });
});
