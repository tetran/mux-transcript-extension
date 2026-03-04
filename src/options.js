// src/options.js
// DeepL API キーの保存・読み込み

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('save');
  const statusEl = document.getElementById('status');

  // 保存済みのAPIキーを読み込む
  chrome.storage.sync.get(['deeplApiKey'], (result) => {
    if (result.deeplApiKey) {
      apiKeyInput.value = result.deeplApiKey;
    }
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    chrome.storage.sync.set({ deeplApiKey: apiKey }, () => {
      statusEl.textContent = apiKey ? '保存しました' : 'APIキーを削除しました';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 2000);
    });
  });
});
