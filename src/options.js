// src/options.js
// DeepL API キーおよび翻訳オプションの保存・読み込み

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const formalitySelect = document.getElementById('formality');
  const customInstructionsTextarea = document.getElementById('customInstructions');
  const charCountEl = document.getElementById('charCount');
  const saveButton = document.getElementById('save');
  const statusEl = document.getElementById('status');

  // 保存済みの設定を読み込む
  chrome.storage.sync.get(
    { deeplApiKey: '', deeplFormality: 'default', deeplCustomInstructions: '' },
    (result) => {
      apiKeyInput.value = result.deeplApiKey;
      formalitySelect.value = result.deeplFormality;
      customInstructionsTextarea.value = result.deeplCustomInstructions;
      charCountEl.textContent = `${result.deeplCustomInstructions.length} / 300`;
    }
  );

  // 文字数カウンターのリアルタイム更新
  customInstructionsTextarea.addEventListener('input', () => {
    charCountEl.textContent = `${customInstructionsTextarea.value.length} / 300`;
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const formality = formalitySelect.value;
    const customInstructions = customInstructionsTextarea.value.trim();
    chrome.storage.sync.set(
      { deeplApiKey: apiKey, deeplFormality: formality, deeplCustomInstructions: customInstructions },
      () => {
        statusEl.textContent = '設定を保存しました';
        setTimeout(() => {
          statusEl.textContent = '';
        }, 2000);
      }
    );
  });
});
