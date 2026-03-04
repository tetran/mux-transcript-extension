// src/translator.js
// DeepL Free API を使ったテキスト翻訳
// 実際のfetchはbackground service workerが行う（CORS回避）

// セッション内メモリキャッシュ（key: JSON.stringify([text, formality, customInstructions]), value: 訳文）
const translationCache = new Map();

/**
 * chrome.storage.sync から DeepL API キーを取得する
 * @returns {Promise<string|null>}
 */
function getDeepLApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['deeplApiKey'], (result) => {
      resolve(result.deeplApiKey || null);
    });
  });
}

/**
 * chrome.storage.sync から翻訳オプションを取得する
 * @returns {Promise<{ formality: string, customInstructions: string }>}
 */
function getTranslationOptions() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { deeplFormality: 'default', deeplCustomInstructions: '' },
      (result) => resolve({
        formality: result.deeplFormality ?? 'default',
        customInstructions: result.deeplCustomInstructions ?? '',
      })
    );
  });
}

/**
 * キャッシュキーを構築する
 * @param {string} text
 * @param {string} formality
 * @param {string} customInstructions
 * @returns {string}
 */
function buildCacheKey(text, formality, customInstructions) {
  return JSON.stringify([text, formality, customInstructions]);
}

/**
 * background service worker に TRANSLATE メッセージを送って翻訳結果を受け取る
 * @param {{ apiKey: string, texts: string[], formality: string, customInstructions: string }} params
 * @returns {Promise<{ ok: boolean, translations?: {text: string}[], error?: string }>}
 */
function sendTranslateMessage({ apiKey, texts, formality, customInstructions }) {
  const message = { type: 'TRANSLATE', apiKey, texts, formality };
  if (customInstructions) message.customInstructions = customInstructions;
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response' });
    });
  });
}

/**
 * DeepL Free API でテキスト配列を一括翻訳する
 * キャッシュあり → キャッシュから返す
 * APIキーなし → そのまま返す
 * @param {string[]} texts
 * @returns {Promise<string[]>}
 */
async function translateTexts(texts) {
  if (!texts || texts.length === 0) return [];

  const apiKey = await getDeepLApiKey();
  if (!apiKey) return texts;

  const { formality, customInstructions } = await getTranslationOptions();

  const uncached = texts.filter((t) => !translationCache.has(buildCacheKey(t, formality, customInstructions)));

  if (uncached.length > 0) {
    const response = await sendTranslateMessage({ apiKey, texts: uncached, formality, customInstructions });
    if (!response.ok || !Array.isArray(response.translations) || response.translations.length < uncached.length) {
      console.warn('[mux-subtitle] 翻訳失敗、原文にフォールバック:', response.error);
      return texts;
    }
    uncached.forEach((original, i) => {
      translationCache.set(buildCacheKey(original, formality, customInstructions), response.translations[i].text);
    });
  }

  return texts.map((t) => translationCache.get(buildCacheKey(t, formality, customInstructions)) ?? t);
}

/**
 * entries 配列を翻訳して新しい配列を返す
 * @param {{ startSec: number, text: string }[]} entries
 * @returns {Promise<{ startSec: number, text: string }[]>}
 */
async function translateEntries(entries) {
  if (!entries || entries.length === 0) return [];
  const texts = entries.map((e) => e.text);
  const translated = await translateTexts(texts);
  return entries.map((e, i) => ({ ...e, text: translated[i] }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getDeepLApiKey, getTranslationOptions, translateTexts, translateEntries };
}
