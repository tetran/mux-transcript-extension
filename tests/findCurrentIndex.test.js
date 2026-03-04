const { findCurrentIndex } = require('../src/utils');

describe('findCurrentIndex', () => {
  const entries = [
    { startSec: 0, text: 'intro' },
    { startSec: 10, text: 'second' },
    { startSec: 20, text: 'third' },
    { startSec: 30, text: 'fourth' },
  ];

  test('ちょうど開始時刻のとき該当インデックスを返す', () => {
    expect(findCurrentIndex(entries, 0)).toBe(0);
    expect(findCurrentIndex(entries, 10)).toBe(1);
    expect(findCurrentIndex(entries, 30)).toBe(3);
  });

  test('開始時刻と次の開始時刻の間のとき直前のインデックスを返す', () => {
    expect(findCurrentIndex(entries, 5)).toBe(0);
    expect(findCurrentIndex(entries, 15)).toBe(1);
    expect(findCurrentIndex(entries, 25)).toBe(2);
    expect(findCurrentIndex(entries, 50)).toBe(3);
  });

  test('最初のエントリより前のとき -1 を返す', () => {
    expect(findCurrentIndex(entries, -1)).toBe(-1);
  });

  test('entries が空のとき -1 を返す', () => {
    expect(findCurrentIndex([], 10)).toBe(-1);
  });

  test('entries が null/undefined のとき -1 を返す', () => {
    expect(findCurrentIndex(null, 10)).toBe(-1);
    expect(findCurrentIndex(undefined, 10)).toBe(-1);
  });
});
