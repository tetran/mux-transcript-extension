const { toggleApiKeyVisibility } = require('../src/options');

describe('toggleApiKeyVisibility', () => {
  let input, button;

  beforeEach(() => {
    input = document.createElement('input');
    input.type = 'password';
    button = document.createElement('button');
    button.textContent = '表示';
  });

  test('password → text に切り替わる', () => {
    toggleApiKeyVisibility(input, button);
    expect(input.type).toBe('text');
    expect(button.textContent).toBe('非表示');
  });

  test('text → password に戻る', () => {
    input.type = 'text';
    button.textContent = '非表示';
    toggleApiKeyVisibility(input, button);
    expect(input.type).toBe('password');
    expect(button.textContent).toBe('表示');
  });
});
