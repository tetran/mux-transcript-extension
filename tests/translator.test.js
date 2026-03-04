// tests/translator.test.js
// translator.js のユニットテスト

// chrome モック
const mockGet = jest.fn();
const mockSendMessage = jest.fn();
global.chrome = {
  storage: {
    sync: {
      get: mockGet,
    },
  },
  runtime: {
    sendMessage: mockSendMessage,
    lastError: null,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  global.chrome.runtime.lastError = null;
});

function loadTranslator() {
  return require('../src/translator');
}

describe('getDeepLApiKey', () => {
  test('storage にキーがあれば返す', async () => {
    const { getDeepLApiKey } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'test-key-123' }));
    const key = await getDeepLApiKey();
    expect(key).toBe('test-key-123');
  });

  test('storage にキーがなければ null を返す', async () => {
    const { getDeepLApiKey } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({}));
    const key = await getDeepLApiKey();
    expect(key).toBeNull();
  });
});

describe('translateTexts', () => {
  test('APIキーなし → 原文をそのまま返す', async () => {
    const { translateTexts } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({}));
    const result = await translateTexts(['Hello', 'World']);
    expect(result).toEqual(['Hello', 'World']);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('APIキーあり・キャッシュなし → background に TRANSLATE メッセージを送る', async () => {
    const { translateTexts } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'my-api-key' }));
    mockSendMessage.mockImplementation((msg, cb) =>
      cb({ ok: true, translations: [{ text: 'こんにちは' }, { text: '世界' }] })
    );
    const result = await translateTexts(['Hello', 'World']);
    expect(result).toEqual(['こんにちは', '世界']);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const msg = mockSendMessage.mock.calls[0][0];
    expect(msg.type).toBe('TRANSLATE');
    expect(msg.apiKey).toBe('my-api-key');
    expect(msg.texts).toEqual(['Hello', 'World']);
  });

  test('APIキーあり・キャッシュあり → sendMessage を呼ばずキャッシュから返す', async () => {
    const { translateTexts } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'my-api-key' }));
    mockSendMessage.mockImplementation((msg, cb) =>
      cb({ ok: true, translations: [{ text: 'こんにちは' }, { text: '世界' }] })
    );
    // 1回目: API呼び出し
    const first = await translateTexts(['Hello', 'World']);
    expect(first).toEqual(['こんにちは', '世界']);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // 2回目: キャッシュから
    mockSendMessage.mockClear();
    const second = await translateTexts(['Hello', 'World']);
    expect(second).toEqual(['こんにちは', '世界']);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('API 失敗時 → 原文にフォールバック', async () => {
    const { translateTexts } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'my-api-key' }));
    mockSendMessage.mockImplementation((msg, cb) =>
      cb({ ok: false, error: 'DeepL error 403' })
    );
    const result = await translateTexts(['Hello', 'World']);
    expect(result).toEqual(['Hello', 'World']);
  });

  test('sendMessage が応答なし（lastError）→ 原文にフォールバック', async () => {
    const { translateTexts } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'my-api-key' }));
    mockSendMessage.mockImplementation((msg, cb) => {
      global.chrome.runtime.lastError = { message: 'Extension context invalidated' };
      cb(undefined);
    });
    const result = await translateTexts(['Hello']);
    expect(result).toEqual(['Hello']);
  });

  test('空配列を渡したとき空配列を返す', async () => {
    const { translateTexts } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'my-api-key' }));
    const result = await translateTexts([]);
    expect(result).toEqual([]);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('一部キャッシュ済みのとき未キャッシュ分だけ送る', async () => {
    const { translateTexts } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'my-api-key' }));

    // 1回目: Hello だけキャッシュ
    mockSendMessage.mockImplementationOnce((msg, cb) =>
      cb({ ok: true, translations: [{ text: 'こんにちは' }] })
    );
    await translateTexts(['Hello']);

    // 2回目: Hello はキャッシュ済み、World だけ送信
    mockSendMessage.mockClear();
    mockSendMessage.mockImplementationOnce((msg, cb) =>
      cb({ ok: true, translations: [{ text: '世界' }] })
    );
    const result = await translateTexts(['Hello', 'World']);
    expect(result).toEqual(['こんにちは', '世界']);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0].texts).toEqual(['World']);
  });
});

describe('translateEntries', () => {
  test('entries 配列の text を翻訳して返す', async () => {
    const { translateEntries } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({ deeplApiKey: 'my-api-key' }));
    mockSendMessage.mockImplementation((msg, cb) =>
      cb({ ok: true, translations: [{ text: 'こんにちは' }, { text: 'レッスンにようこそ' }] })
    );
    const entries = [
      { startSec: 0, text: 'Hello' },
      { startSec: 10, text: 'Welcome to the lesson' },
    ];
    const result = await translateEntries(entries);
    expect(result).toEqual([
      { startSec: 0, text: 'こんにちは' },
      { startSec: 10, text: 'レッスンにようこそ' },
    ]);
  });

  test('APIキーなし → 原文 entries をそのまま返す', async () => {
    const { translateEntries } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({}));
    const entries = [
      { startSec: 0, text: 'Hello' },
      { startSec: 5, text: 'World' },
    ];
    const result = await translateEntries(entries);
    expect(result).toEqual(entries);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('空配列を渡したとき空配列を返す', async () => {
    const { translateEntries } = loadTranslator();
    mockGet.mockImplementation((keys, cb) => cb({}));
    const result = await translateEntries([]);
    expect(result).toEqual([]);
  });
});
