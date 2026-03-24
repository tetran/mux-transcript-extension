// src/options.js
// DeepL API キーおよび翻訳オプションの保存・読み込み

const DEFAULTS = {
  deeplFormality: 'default',
  subtitleMinDisplaySeconds: 2,
  subtitleFontSize: 16,
  deeplCustomInstructions: '',
};

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const formalitySelect = document.getElementById('formality');
  const minDisplaySecondsInput = document.getElementById('minDisplaySeconds');
  const minDisplayValueEl = document.getElementById('minDisplayValue');
  const subtitleFontSizeInput = document.getElementById('subtitleFontSize');
  const fontSizeValueEl = document.getElementById('fontSizeValue');
  const customInstructionsTextarea = document.getElementById('customInstructions');
  const charCountEl = document.getElementById('charCount');
  const saveButton = document.getElementById('save');
  const resetButton = document.getElementById('reset');
  const statusEl = document.getElementById('status');

  // 保存済みの設定を読み込む
  chrome.storage.sync.get(
    { deeplApiKey: '', ...DEFAULTS },
    (result) => {
      apiKeyInput.value = result.deeplApiKey;
      formalitySelect.value = result.deeplFormality;
      minDisplaySecondsInput.value = result.subtitleMinDisplaySeconds;
      minDisplayValueEl.textContent = `${Number(result.subtitleMinDisplaySeconds).toFixed(1)} 秒`;
      subtitleFontSizeInput.value = result.subtitleFontSize;
      fontSizeValueEl.textContent = `${result.subtitleFontSize}px`;
      customInstructionsTextarea.value = result.deeplCustomInstructions;
      charCountEl.textContent = `${result.deeplCustomInstructions.length} / 300`;
    }
  );

  // 最小表示時間のリアルタイム表示更新
  minDisplaySecondsInput.addEventListener('input', () => {
    minDisplayValueEl.textContent = `${Number(minDisplaySecondsInput.value).toFixed(1)} 秒`;
  });

  // 文字サイズのリアルタイム表示更新
  subtitleFontSizeInput.addEventListener('input', () => {
    fontSizeValueEl.textContent = `${subtitleFontSizeInput.value}px`;
  });

  // 文字数カウンターのリアルタイム更新
  customInstructionsTextarea.addEventListener('input', () => {
    charCountEl.textContent = `${customInstructionsTextarea.value.length} / 300`;
  });

  resetButton.addEventListener('click', () => {
    if (!window.confirm('APIキー以外の設定をデフォルトに戻しますか？')) return;

    formalitySelect.value = DEFAULTS.deeplFormality;
    minDisplaySecondsInput.value = DEFAULTS.subtitleMinDisplaySeconds;
    subtitleFontSizeInput.value = DEFAULTS.subtitleFontSize;
    customInstructionsTextarea.value = DEFAULTS.deeplCustomInstructions;

    minDisplaySecondsInput.dispatchEvent(new Event('input'));
    subtitleFontSizeInput.dispatchEvent(new Event('input'));
    customInstructionsTextarea.dispatchEvent(new Event('input'));

    chrome.storage.sync.set(DEFAULTS, () => {
      statusEl.textContent = '設定をリセットしました';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 2000);
    });
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const formality = formalitySelect.value;
    const subtitleMinDisplaySeconds = Number(minDisplaySecondsInput.value);
    const subtitleFontSize = Number(subtitleFontSizeInput.value);
    const customInstructions = customInstructionsTextarea.value.trim();
    chrome.storage.sync.set(
      { deeplApiKey: apiKey, deeplFormality: formality, subtitleMinDisplaySeconds, subtitleFontSize, deeplCustomInstructions: customInstructions },
      () => {
        statusEl.textContent = '設定を保存しました';
        setTimeout(() => {
          statusEl.textContent = '';
        }, 2000);
      }
    );
  });

  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  toggleApiKeyBtn.addEventListener('click', () => {
    toggleApiKeyVisibility(apiKeyInput, toggleApiKeyBtn);
  });
});

function toggleApiKeyVisibility(input, button) {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  button.textContent = isPassword ? '非表示' : '表示';
}

if (typeof module !== 'undefined') {
  module.exports = { toggleApiKeyVisibility };
}
