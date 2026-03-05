// src/options.js
// DeepL API キーおよび翻訳オプションの保存・読み込み

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const formalitySelect = document.getElementById('formality');
  const minDisplaySecondsInput = document.getElementById('minDisplaySeconds');
  const minDisplayValueEl = document.getElementById('minDisplayValue');
  const customInstructionsTextarea = document.getElementById('customInstructions');
  const charCountEl = document.getElementById('charCount');
  const saveButton = document.getElementById('save');
  const statusEl = document.getElementById('status');

  // 保存済みの設定を読み込む
  chrome.storage.sync.get(
    { deeplApiKey: '', deeplFormality: 'default', subtitleMinDisplaySeconds: 2, deeplCustomInstructions: '' },
    (result) => {
      apiKeyInput.value = result.deeplApiKey;
      formalitySelect.value = result.deeplFormality;
      minDisplaySecondsInput.value = result.subtitleMinDisplaySeconds;
      minDisplayValueEl.textContent = `${Number(result.subtitleMinDisplaySeconds).toFixed(1)} 秒`;
      customInstructionsTextarea.value = result.deeplCustomInstructions;
      charCountEl.textContent = `${result.deeplCustomInstructions.length} / 300`;
    }
  );

  // 最小表示時間のリアルタイム表示更新
  minDisplaySecondsInput.addEventListener('input', () => {
    minDisplayValueEl.textContent = `${Number(minDisplaySecondsInput.value).toFixed(1)} 秒`;
  });

  // 文字数カウンターのリアルタイム更新
  customInstructionsTextarea.addEventListener('input', () => {
    charCountEl.textContent = `${customInstructionsTextarea.value.length} / 300`;
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const formality = formalitySelect.value;
    const subtitleMinDisplaySeconds = Number(minDisplaySecondsInput.value);
    const customInstructions = customInstructionsTextarea.value.trim();
    chrome.storage.sync.set(
      { deeplApiKey: apiKey, deeplFormality: formality, subtitleMinDisplaySeconds, deeplCustomInstructions: customInstructions },
      () => {
        statusEl.textContent = '設定を保存しました';
        setTimeout(() => {
          statusEl.textContent = '';
        }, 2000);
      }
    );
  });
});
