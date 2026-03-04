# 実装プラン — mux-translation-extension

## Context

Laravel Learn のレッスンページ (`https://laravel.com/learn/*`) で Mux Player の再生時間に同期して Transcript タブの字幕を表示する Chrome Extension (Manifest V3) を新規作成する。翻訳機能は内包せず、ブラウザ翻訳後の `innerText` を使う。

---

## ファイル構成

```
mux-translation-extension/
├── manifest.json
├── src/
│   └── utils.js          ← 純粋関数のみ（parseTimecode, findCurrentIndex, parseTranscript）
├── content-script.js     ← DOM操作・イベント購読（src/utils.js のグローバル関数を使う）
├── styles.css
├── tests/
│   ├── parseTimecode.test.js
│   ├── findCurrentIndex.test.js
│   └── parseTranscript.test.js
└── package.json
```

**src/ 分割の理由**: Jest は Node.js 環境のため browser globals を持つ content-script.js を直接 import するとテストが壊れる。純粋関数だけを `src/utils.js` に切り出し、Jest は `src/utils.js` だけを require する。

---

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "Laravel Learn Mux Subtitle",
  "version": "1.0.0",
  "description": "Mux Player の再生時間に同期して Transcript の字幕を表示する",
  "host_permissions": ["https://laravel.com/learn/*"],
  "content_scripts": [
    {
      "matches": ["https://laravel.com/learn/*"],
      "js": ["src/utils.js", "content-script.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ]
}
```

---

## src/utils.js の関数設計

### parseTimecode(str: string): number
- `mm:ss` → `m*60 + s`
- `hh:mm:ss` → `h*3600 + m*60 + s`
- 不正値は 0

### findCurrentIndex(entries, currentTime): number
- 二分探索: `upperBound(entries, currentTime) - 1`
- `startSec <= currentTime` を満たす最大 index
- 非表示は -1

### parseTranscript(containerEl: Element): Array<{startSec, text}>
- セレクタ定数で行・タイムコード・テキストを抽出
- `innerText` を使用（翻訳後のテキストを優先）
- タイムコードなし or テキスト空の行はスキップ

### export 戦略（ブラウザ＆Jest 両対応）
```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseTimecode, findCurrentIndex, parseTranscript };
}
```

---

## content-script.js の関数設計

```
init()
  └─ waitForMuxPlayer()              ← MutationObserver + 15秒タイムアウト
       └─ onMuxPlayerReady(muxPlayer)
            ├─ insertSubtitleContainer(muxPlayer)   ← aria-live="polite"付き
            ├─ openTranscriptTab()                  ← テキストマッチフォールバックあり
            │    └─ waitForTranscriptDOM()           ← 10秒タイムアウト
            │         └─ setupTranscript(containerEl)
            │              ├─ parseTranscript()      ← utils.js
            │              └─ attachMutationObserver() ← debounce 100ms
            └─ muxPlayer.addEventListener('timeupdate', onTimeUpdate)
            └─ muxPlayer.addEventListener('seeked', onTimeUpdate)      ← seek直後に即反映
            └─ muxPlayer.addEventListener('loadedmetadata', onTimeUpdate)
                  └─ index 変化時のみ updateSubtitleDOM()  ← 最適化
                  └─ index === -1 の場合は字幕を即クリア
```

---

## Transcript DOM セレクタ

**実地調査済み（2026-03-04）**:

サイトは Livewire を使用。Transcript パネルの構造：

```html
<!-- 字幕行（1行＝1エントリ） -->
<div wire:click="$dispatch('seek-video', { time: '00:00' })" class="group ...">
  <span class="font-commit-mono ...">00:00</span>
  <div class="font-sans ...">字幕テキスト</div>
</div>
```

```javascript
// タブボタン: Alpine.js の @click 属性で特定（Chrome翻訳の影響なし）
// ※ CSS セレクタ内の @ は \@ でエスケープ必要
const TRANSCRIPT_TAB_SELECTOR = '[\\@click*="transcript"]';

// 字幕行: wire:click 属性で確実に特定できる（Chrome翻訳の影響なし）
const TRANSCRIPT_ROW_SELECTOR = '[wire:click*="seek-video"]';

// タイムコード取得（2択どちらでも可）
// A: wire:click 属性をパース
const timeStr = el.getAttribute('wire:click').match(/time:\s*'([\d:]+)'/)[1];
// B: span の innerText を読む
const timeStr = el.querySelector('span').innerText.trim();

// テキスト取得
const TRANSCRIPT_TEXT_SELECTOR = 'div.font-sans, div[class*="font-sans"]';
```

`parseTranscript` は `containerEl.querySelectorAll(TRANSCRIPT_ROW_SELECTOR)` で行を取得し、
タイムコードは方法 A（wire:click パース）を採用する（クラス名変更に強い）。

`openTranscriptTab` はタブボタンを `.click()` した後、`[wire:click*="seek-video"]` が出現するまで待機する。

---

## package.json (devDependencies)

```json
{
  "scripts": { "test": "jest", "test:watch": "jest --watch" },
  "devDependencies": {
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "testMatch": ["**/tests/**/*.test.js"]
  }
}
```

---

## TDD 実装順序

### Phase 1: 純粋関数の TDD（src/utils.js）
1. `package.json` 作成 → `npm install`
2. `tests/parseTimecode.test.js` 作成（RED）
3. `src/utils.js` に `parseTimecode` 実装（GREEN）
4. `tests/findCurrentIndex.test.js` 作成（RED）
5. `src/utils.js` に `findCurrentIndex` 実装（GREEN）
6. `tests/parseTranscript.test.js` 作成・仮セレクタで（RED）
7. `src/utils.js` に `parseTranscript` 実装（GREEN）
8. REFACTOR

### Phase 2: セレクタ確定
9. ~~実際のページを DevTools で調査 → セレクタ定数を更新~~ **完了（2026-03-04）**
   - 字幕行: `[wire:click*="seek-video"]` で確定
   - タイムコード: `wire:click` 属性パース（方法A）で確定
   - テキスト: `div.font-sans` で確定
   - タブボタン: `[\\@click*="transcript"]` で確定（Alpine.js）
10. `tests/parseTranscript.test.js` の fixture を実際の構造に合わせ更新（RED→GREEN）

### Phase 3: content-script.js 実装
11. `manifest.json`・`styles.css` 作成
12. `content-script.js` の各関数を順に実装・手動確認
13. `openTranscriptTab` + MutationObserver 系の実装

### Phase 3.5: content-script.js の DOM ユニットテスト（jsdom）
14. `tests/openTranscriptTab.test.js` — Alpine.js タブクリック → 字幕行出現の確認
15. `tests/setupTranscript.test.js` — `[wire:click*="seek-video"]` 行からエントリ配列生成
16. `tests/updateSubtitleDOM.test.js` — index変化・-1時のクリア・aria-live 更新

### Phase 4: 手動テスト（SPEC.md §14 テスト計画）
- 字幕が表示される
- 再生・停止・シークで字幕切替
- Transcript タブ未展開でも動作（自動展開）
- Chrome 翻訳 ON で日本語字幕表示
- リロード後も安定

---

## エッジケース対応

| ケース | 対応 |
|---|---|
| mux-player が存在しない | Observer + 15秒タイムアウト → ログのみ |
| Transcript タブが存在しない | 警告ログ → 10秒タイムアウト → 字幕欄にメッセージ |
| 重複挿入 | `getElementById('mux-subtitle-container')` で確認してスキップ |
| ブラウザ翻訳 OFF→ON | MutationObserver → debounce 100ms → 再パース |
| 早送り/巻き戻し連打 | `seeked` + `timeupdate` で即反映。`index === -1` 時は字幕クリア |

---

## 検証方法

1. `npm test` で全テストがパス
2. `chrome://extensions/` で "デベロッパーモード" → 「パッケージ化されていない拡張機能を読み込む」でフォルダを指定
3. `https://laravel.com/learn/getting-started-with-laravel/what-are-we-building` を開いて動作確認
4. Chrome の「ページを翻訳」で日本語化 → 字幕が日本語になることを確認
