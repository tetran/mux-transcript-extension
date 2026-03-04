const { parseTimecode } = require('../src/utils');

describe('parseTimecode', () => {
  test('mm:ss 形式をパースできる', () => {
    expect(parseTimecode('00:00')).toBe(0);
    expect(parseTimecode('01:30')).toBe(90);
    expect(parseTimecode('59:59')).toBe(3599);
  });

  test('hh:mm:ss 形式をパースできる', () => {
    expect(parseTimecode('01:00:00')).toBe(3600);
    expect(parseTimecode('01:01:01')).toBe(3661);
    expect(parseTimecode('02:30:45')).toBe(9045);
  });

  test('不正値は 0 を返す', () => {
    expect(parseTimecode('')).toBe(0);
    expect(parseTimecode(null)).toBe(0);
    expect(parseTimecode(undefined)).toBe(0);
    expect(parseTimecode('abc')).toBe(0);
    expect(parseTimecode('12:ab')).toBe(0);
  });
});
