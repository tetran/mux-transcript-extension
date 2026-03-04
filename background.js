// background.js (service worker)
// content script からの翻訳リクエストを受けて DeepL Free API を呼ぶ

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'TRANSLATE') return false;

  const { apiKey, texts } = message;

  fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts, target_lang: 'JA' }),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn('[mux-subtitle:bg] DeepL APIエラー:', res.status);
        sendResponse({ ok: false, error: `HTTP ${res.status}` });
        return;
      }
      return res.json().then((data) => {
        sendResponse({ ok: true, translations: data.translations });
      });
    })
    .catch((err) => {
      console.warn('[mux-subtitle:bg] fetch失敗:', err.message);
      sendResponse({ ok: false, error: err.message });
    });

  return true; // 非同期レスポンスのため必須
});
