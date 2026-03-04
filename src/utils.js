/**
 * タイムコード文字列を秒数に変換する
 * @param {string} str - "mm:ss" または "hh:mm:ss" 形式
 * @returns {number} 秒数（不正値は 0）
 */
function parseTimecode(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * 現在の再生時間に対応する字幕エントリのインデックスを返す（二分探索）
 * @param {Array<{startSec: number}>} entries - 字幕エントリの配列（startSec 昇順）
 * @param {number} currentTime - 現在の再生時間（秒）
 * @returns {number} インデックス（対象なしは -1）
 */
function findCurrentIndex(entries, currentTime) {
  if (!entries || entries.length === 0) return -1;
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid].startSec <= currentTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const index = lo - 1;
  return index < 0 ? -1 : index;
}

const TRANSCRIPT_ROW_SELECTOR = '[wire\\:click*="seek-video"]';
const TRANSCRIPT_TEXT_SELECTOR = 'div.font-sans, div[class*="font-sans"]';

/**
 * Transcript コンテナから字幕エントリの配列を生成する
 * @param {Element} containerEl - 字幕コンテナ要素
 * @returns {Array<{startSec: number, text: string}>}
 */
function parseTranscript(containerEl) {
  if (!containerEl) return [];
  const rows = containerEl.querySelectorAll(TRANSCRIPT_ROW_SELECTOR);
  const entries = [];
  rows.forEach((row) => {
    const wireClick = row.getAttribute('wire:click') || '';
    const match = wireClick.match(/time:\s*['"]([0-9:.]+)['"]/);
    if (!match) return;
    const startSec = parseTimecode(match[1]);
    const textEl = row.querySelector(TRANSCRIPT_TEXT_SELECTOR);
    const text = textEl
      ? (textEl.dataset?.muxOriginal || textEl.innerText || textEl.textContent || '').trim()
      : '';
    if (!text) return;
    entries.push({ startSec, text });
  });
  return entries;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseTimecode, findCurrentIndex, parseTranscript };
}
