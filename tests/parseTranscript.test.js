const { parseTranscript } = require('../src/utils');

/**
 * 実際の laravel.com/learn の Transcript DOM 構造に合わせたフィクスチャ
 * 字幕行: div:has(> span.font-commit-mono)
 * タイムスタンプ: span.font-commit-mono のテキスト
 * テキスト: div.font-sans
 */
function buildContainer(rows) {
  const container = document.createElement('div');
  rows.forEach(({ time, text }) => {
    const row = document.createElement('div');
    const span = document.createElement('span');
    span.className = 'font-commit-mono';
    span.textContent = time;
    const textDiv = document.createElement('div');
    textDiv.className = 'font-sans';
    textDiv.textContent = text;
    row.appendChild(span);
    row.appendChild(textDiv);
    container.appendChild(row);
  });
  return container;
}

describe('parseTranscript', () => {
  test('正常な行をパースしてエントリ配列を返す', () => {
    const container = buildContainer([
      { time: '00:00', text: 'Welcome to the course' },
      { time: '00:10', text: 'In this lesson...' },
      { time: '01:30', text: 'Let us get started' },
    ]);
    const entries = parseTranscript(container);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ startSec: 0, text: 'Welcome to the course' });
    expect(entries[1]).toEqual({ startSec: 10, text: 'In this lesson...' });
    expect(entries[2]).toEqual({ startSec: 90, text: 'Let us get started' });
  });

  test('テキストが空の行はスキップする', () => {
    const container = buildContainer([
      { time: '00:00', text: 'First line' },
      { time: '00:10', text: '' },
      { time: '00:20', text: 'Third line' },
    ]);
    const entries = parseTranscript(container);
    expect(entries).toHaveLength(2);
    expect(entries[0].startSec).toBe(0);
    expect(entries[1].startSec).toBe(20);
  });

  test('タイムスタンプ span がない行はスキップする', () => {
    const container = document.createElement('div');
    const row = document.createElement('div');
    const textDiv = document.createElement('div');
    textDiv.className = 'font-sans';
    textDiv.textContent = 'No timestamp span';
    row.appendChild(textDiv);
    container.appendChild(row);

    const entries = parseTranscript(container);
    expect(entries).toHaveLength(0);
  });

  test('空のコンテナのとき空配列を返す', () => {
    const container = document.createElement('div');
    expect(parseTranscript(container)).toEqual([]);
  });

  test('null/undefined のとき空配列を返す', () => {
    expect(parseTranscript(null)).toEqual([]);
    expect(parseTranscript(undefined)).toEqual([]);
  });

  test('hh:mm:ss 形式の時刻をパースする', () => {
    const container = buildContainer([
      { time: '01:30:00', text: 'One hour thirty minutes' },
    ]);
    const entries = parseTranscript(container);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ startSec: 5400, text: 'One hour thirty minutes' });
  });

  test('小数秒を含む時刻をパースする', () => {
    const container = buildContainer([
      { time: '00:10.5', text: 'Decimal seconds' },
    ]);
    const entries = parseTranscript(container);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ startSec: 10.5, text: 'Decimal seconds' });
  });

  test('data-mux-original 属性があれば textContent より優先して使う', () => {
    const container = document.createElement('div');
    const row = document.createElement('div');
    const span = document.createElement('span');
    span.className = 'font-commit-mono';
    span.textContent = '00:05';
    const textDiv = document.createElement('div');
    textDiv.className = 'font-sans';
    textDiv.dataset.muxOriginal = 'Original English text';
    textDiv.textContent = '翻訳済み日本語テキスト';
    row.appendChild(span);
    row.appendChild(textDiv);
    container.appendChild(row);

    const entries = parseTranscript(container);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ startSec: 5, text: 'Original English text' });
  });
});
