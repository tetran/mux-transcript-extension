// content-script.js
// src/utils.js のグローバル関数（parseTimecode, findCurrentIndex, parseTranscript）を使用
// 時刻は bridge.js (MAIN world) から postMessage で受け取る

const MUX_PLAYER_SELECTOR = 'mux-player';
const SUBTITLE_CONTAINER_ID = 'mux-subtitle-container';

let entries = [];
let lastIndex = -2; // -2 = 未初期化
let debounceTimer = null;
let transcriptObserver = null;
let originalMuxPlayerPosition = null;
let currentMinMs = 0;
let minDisplayController = createMinDisplayController(currentMinMs, updateSubtitleDOM);

// ──────────────────────────────────────────
// 字幕 DOM の挿入
// ──────────────────────────────────────────
function insertSubtitleContainer(muxPlayer) {
  if (document.getElementById(SUBTITLE_CONTAINER_ID)) return;
  const style = getComputedStyle(muxPlayer);
  if (style.position === 'static') {
    originalMuxPlayerPosition = muxPlayer.style.position;
    muxPlayer.style.position = 'relative';
  }
  const container = document.createElement('div');
  container.id = SUBTITLE_CONTAINER_ID;
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'true');
  const text = document.createElement('span');
  text.id = 'mux-subtitle-text';
  container.appendChild(text);
  muxPlayer.appendChild(container);
}

// ──────────────────────────────────────────
// 字幕テキストの更新
// ──────────────────────────────────────────
function updateSubtitleDOM(index) {
  if (index === lastIndex) return;
  lastIndex = index;
  const textEl = document.getElementById('mux-subtitle-text');
  if (!textEl) return;
  textEl.textContent = index >= 0 && entries[index] ? entries[index].text : '';
}

// ──────────────────────────────────────────
// bridge.js からの postMessage を受け取って字幕を更新
// ──────────────────────────────────────────
function onBridgeMessage(event) {
  if (event.source !== window || !event.data?.__muxSubtitle) return;
  const muxPlayer = document.querySelector(MUX_PLAYER_SELECTOR);
  const expectedToken = muxPlayer?.dataset.muxBridgeToken;
  if (!expectedToken || event.data.token !== expectedToken) return;
  if (!Number.isFinite(event.data.currentTime)) return;
  const index = findCurrentIndex(entries, event.data.currentTime);
  const bypass = event.data.eventType !== 'timeupdate';
  minDisplayController.update(index, bypass);
}

// ──────────────────────────────────────────
// Transcript タブの DOM を翻訳済みテキストで書き換える
// Observer を一時切断して無限ループを防ぐ
// ──────────────────────────────────────────
function updateTranscriptDOM(containerEl, translatedEntries) {
  if (!containerEl || !translatedEntries.length) return;
  if (transcriptObserver) transcriptObserver.disconnect();

  const rows = containerEl.querySelectorAll(TRANSCRIPT_ROW_SELECTOR);
  let entryIndex = 0;
  rows.forEach((row) => {
    if (entryIndex >= translatedEntries.length) return;
    const timestampEl = row.querySelector(TRANSCRIPT_TIMESTAMP_SELECTOR);
    if (!timestampEl) return;
    const textEl = row.querySelector(TRANSCRIPT_TEXT_SELECTOR);
    if (!textEl) return;
    const originalText = (textEl.dataset.muxOriginal || textEl.innerText || textEl.textContent || '').trim();
    if (!originalText) return;
    textEl.dataset.muxOriginal = textEl.dataset.muxOriginal || originalText;
    textEl.textContent = translatedEntries[entryIndex].text;
    entryIndex++;
  });

  if (transcriptObserver) {
    transcriptObserver.observe(containerEl, { childList: true, subtree: true, characterData: true });
  }
}

// ──────────────────────────────────────────
// MutationObserver で字幕行の変化を検知して再パース
// ──────────────────────────────────────────
function attachMutationObserver(containerEl) {
  if (transcriptObserver) transcriptObserver.disconnect();
  transcriptObserver = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const rawEntries = parseTranscript(containerEl);
      entries = await translateEntries(rawEntries);
      updateTranscriptDOM(containerEl, entries);
      lastIndex = -2;
      minDisplayController.dispose();
      minDisplayController = createMinDisplayController(currentMinMs, updateSubtitleDOM);
    }, 100);
  });
  transcriptObserver.observe(containerEl, { childList: true, subtree: true, characterData: true });
}

// ──────────────────────────────────────────
// Transcript コンテナが出現するまで待機
// ──────────────────────────────────────────
function waitForTranscriptDOM(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(TRANSCRIPT_ROW_SELECTOR);
    if (existing) {
      resolve(existing.parentElement);
      return;
    }
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Transcript DOM が出現しなかった'));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(TRANSCRIPT_ROW_SELECTOR);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el.parentElement);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// ──────────────────────────────────────────
// Transcript タブを開く
// ──────────────────────────────────────────
function openTranscriptTab() {
  const tab = findTranscriptTab(document);
  if (!tab) {
    console.warn('[mux-subtitle] Transcript タブが見つからんかった');
    return;
  }
  tab.click();
}

// ──────────────────────────────────────────
// Transcript のセットアップ
// ──────────────────────────────────────────
async function setupTranscript(containerEl) {
  const rawEntries = parseTranscript(containerEl);
  entries = await translateEntries(rawEntries);
  attachMutationObserver(containerEl);
  updateTranscriptDOM(containerEl, entries);
}

// ──────────────────────────────────────────
// mux-player の準備完了後の処理
// ──────────────────────────────────────────
async function onMuxPlayerReady(muxPlayer) {
  insertSubtitleContainer(muxPlayer);
  const textEl = document.getElementById('mux-subtitle-text');
  if (textEl) textEl.textContent = 'Transcript を読み込み中…';
  openTranscriptTab();

  try {
    const containerEl = await waitForTranscriptDOM();
    await setupTranscript(containerEl);
  } catch (e) {
    console.warn('[mux-subtitle]', e.message);
    const textEl = document.getElementById('mux-subtitle-text');
    if (textEl) textEl.textContent = '[字幕を読み込めんかった]';
  }

  window.removeEventListener('message', onBridgeMessage);
  window.addEventListener('message', onBridgeMessage);
}

// ──────────────────────────────────────────
// mux-player が出現するまで待機
// ──────────────────────────────────────────
function waitForMuxPlayer(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(MUX_PLAYER_SELECTOR);
    if (existing) {
      resolve(existing);
      return;
    }
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error('mux-player が出現しなかった'));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(MUX_PLAYER_SELECTOR);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// ──────────────────────────────────────────
// クリーンアップ
// ──────────────────────────────────────────
function cleanup() {
  if (transcriptObserver) {
    transcriptObserver.disconnect();
    transcriptObserver = null;
  }
  window.removeEventListener('message', onBridgeMessage);
  minDisplayController.dispose();
  if (originalMuxPlayerPosition !== null) {
    const muxPlayer = document.querySelector(MUX_PLAYER_SELECTOR);
    if (muxPlayer) muxPlayer.style.position = originalMuxPlayerPosition;
    originalMuxPlayerPosition = null;
  }
}
window.addEventListener('beforeunload', cleanup);

// ──────────────────────────────────────────
// エントリーポイント
// ──────────────────────────────────────────
async function init() {
  chrome.storage.sync.get({ subtitleMinDisplaySeconds: 2 }, (result) => {
    currentMinMs = result.subtitleMinDisplaySeconds * 1000;
    minDisplayController = createMinDisplayController(currentMinMs, updateSubtitleDOM);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.subtitleMinDisplaySeconds) {
      currentMinMs = changes.subtitleMinDisplaySeconds.newValue * 1000;
      minDisplayController.dispose();
      minDisplayController = createMinDisplayController(currentMinMs, updateSubtitleDOM);
    }
  });

  try {
    const muxPlayer = await waitForMuxPlayer();
    await onMuxPlayerReady(muxPlayer);
  } catch (e) {
    console.warn('[mux-subtitle]', e.message);
  }
}

init();
