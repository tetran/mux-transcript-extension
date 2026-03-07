# SPEC.md — Laravel Learn 動画同期字幕（ページ翻訳前提）Chrome Extension

## 1. 概要

Laravel Learn の特定レッスンページ（例：`https://laravel.com/learn/getting-started-with-laravel/what-are-we-building`）上の **Mux Player (`<mux-player>`)** の再生時間に同期して、ページ内の **Transcript タブ**に掲載されているテキスト（※ブラウザ翻訳後の表示テキストを想定）を **動画の直下**に字幕として表示する Chrome Extension を作成する。

本拡張は **オプションで DeepL Free API を用いた自動翻訳機能を持つ**。APIキー未設定の場合は、ユーザーが Chrome の「このページを翻訳」等の機能でページを日本語化した状態を前提に、拡張は **Transcript の”表示文字列”** を拾って字幕表示する。

---

## 2. 目的 / ゴール

- `<mux-player>` の `currentTime` に合わせて、対応する Transcript 行（時刻→テキスト）を字幕表示する
- 字幕は **`<mux-player>` 内部にオーバーレイ**として表示する（`position: absolute; bottom: 48px`）
- Transcript 側のタイムコード（`mm:ss` または `hh:mm:ss`）をパースして同期する
- ブラウザ翻訳を前提に、字幕表示に使う文字列は **翻訳済みの表示テキスト**を優先して取得する

---

## 3. 非ゴール（やらないこと）

- ローカル翻訳モデル・辞書機能による自動翻訳
- 動画プレイヤー内部（Shadow DOM）に直接字幕を描画すること
- 字幕ファイル（VTT/SRT）としてのダウンロード/エクスポート
- 複数言語切替 UI（ブラウザ翻訳に依存）
- Laravel Learn 全ページへの汎用対応（まずは対象ページ群に限定）

---

## 4. 対象環境

- Google Chrome（Manifest V3）
- 対象ページ：`https://laravel.com/learn/*`（初期は Getting Started 系を想定）
- 動画プレイヤー：Mux Player (`<mux-player>` 要素がページ DOM 上に存在することが前提)
- Transcript：ページ内の Transcript タブにタイムコードとテキストが並ぶ UI

---

## 5. ユーザーストーリー

1. ユーザーは Laravel Learn のレッスンページを開く
2. Chrome のページ翻訳機能で日本語に翻訳する（任意だが推奨）
3. 拡張が自動で動画直下に字幕欄を追加する
4. 再生に合わせて字幕が自動更新される
5. Transcript 行のクリックでシークできる既存ページ機能はそのまま（拡張は干渉しない）

---

## 6. 機能要件

### 6.1 字幕表示 UI
- `<mux-player>` 内部に `position: absolute; bottom: 48px` のオーバーレイとして字幕コンテナを挿入する
- 表示内容：
  - 現在行の字幕（必須）
  - （任意）次行/前行のプレビュー、時刻表示
- スタイル：
  - ページデザインを壊さない控えめなカード/帯風
  - 折り返し対応、長文対応
  - ダーク背景でも読めるコントラスト（ページ側に合わせる）

### 6.2 同期ロジック
- `mux-player.currentTime` を用いて現在時刻（秒）を取得する
- `timeupdate` を主トリガーとして字幕更新する
- Transcript 配列 `[{ startSec, text }]` を昇順に持ち、以下で行を決定する：
  - `startSec <= currentTime` を満たす最大の index の行を表示
- シークや速度変更にも追従する（`timeupdate` で追える範囲）

### 6.3 Transcript 抽出
- Transcript タブ内の DOM から以下を抽出する：
  - タイムコード文字列（`mm:ss` / `hh:mm:ss`）
  - 対応するテキスト
- 抽出テキストは翻訳後を優先：
  - まず `innerText`（視覚的に表示されている文字列に近い）で取得
  - `textContent` は hidden 要素が混入しやすいため原則避ける
- Transcript タブが未展開で DOM が存在しない/遅延生成の場合：
  - 自動で Transcript タブを開く（クリックを模倣）
  - DOM 出現を待って抽出する（MutationObserver / ポーリング）

### 6.4 再パース（翻訳ON/OFFやUI変化対応）
- ブラウザ翻訳の切替で Transcript DOM が差し替わる可能性があるため、以下いずれかを行う：
  - Transcript コンテナに MutationObserver を付けて変更検知→再パース
  - 一定条件（例：字幕が空になった）で再パースを試みる

---

## 7. 追加要件（品質）

### 7.1 パフォーマンス
- `timeupdate` は高頻度ではないため基本 OK
- 更新時は「行の index が変わったときのみ DOM 更新」して無駄な reflow を減らす
- Transcript の再パースは必要時のみ（Observer は軽量に）

### 7.2 レジリエンス
- セレクタが変わった場合に備え、重要要素（mux-player / transcript）の探索は段階的に行う
- Transcript が取得できない場合は、字幕欄にエラーメッセージ（小さく）を表示

### 7.3 アクセシビリティ
- 字幕コンテナに `aria-live="polite"` を付与（必要なら）
- キーボード操作を妨げない（フォーカスを奪わない）

---

## 8. 仕様詳細

### 8.1 タイムコード→秒変換
- `mm:ss` → `m*60 + s`
- `hh:mm:ss` → `h*3600 + m*60 + s`
- 不正値は 0 扱い

### 8.2 行選択アルゴリズム
- 推奨：二分探索（行数が多い場合）
- MVP：線形探索でも可（行数が少ないなら十分）
- 実装例：
  - `idx = upperBound(startSecList, currentTime) - 1`
  - `idx < 0` の場合は字幕非表示 or 最初行表示

### 8.3 DOM 挿入位置
- `muxPlayer.appendChild(container)` で `<mux-player>` 内部に字幕コンテナを挿入する
- `mux-player` の `position` が `static` の場合は `relative` に変更して `position: absolute` の子要素が正しく配置されるようにする
- ミニプレイヤー化（スクロール固定）時は字幕も追従する（オーバーレイのため）

---

## 9. UI/UX 仕様（MVP）

- 初回ロード時、字幕欄は「Transcript を読み込み中…」を表示
- Transcript が取得できたらすぐに同期開始
- 動画停止中：最後に表示した字幕を残す（または薄くする）
- 動画未再生で currentTime=0：最初行 or 空表示（要実装判断）

---

## 10. 設定画面

拡張機能の設定ページ（`options.html`）で以下を設定可能：

- **DeepL API キー**：Free API キーを入力して自動翻訳を有効化
- **翻訳のていねいさ**：ていねい / ふつう / カジュアル の3択
- **話し方**（任意・自由入力）：好みの話し方を自由に記述（例: コメディアンぽく、法廷の雰囲気で、など）。最大300文字
- **字幕最小表示時間**：字幕が短時間で切り替わりすぎないよう最低表示秒数を設定（デフォルト 2秒）

将来追加可能：
- 字幕表示 ON/OFF
- フォントサイズ、背景透過、表示行数（1行/2行）
- Transcript 自動展開のON/OFF

---

## 11. セキュリティ / 権限

### 11.1 Manifest V3 権限
- `host_permissions`:
  - `https://laravel.com/learn/*`（コンテンツスクリプト対象）
  - `https://api-free.deepl.com/*`（DeepL Free API 通信用）
- `permissions`:
  - `storage`（APIキー・設定値の保存用）
- 外部通信：DeepL Free API への翻訳リクエストのみ（APIキー設定時）

---

## 12. アーキテクチャ

### 12.1 構成（MVP）
- `manifest.json`
- `content-script.js`
- `styles.css`（任意。CSS を分離する場合）
- （任意）`utils.js`（タイム変換・二分探索）

### 12.2 フロー
1. ページロード後、`mux-player` を待つ（存在確認）
2. 字幕コンテナを挿入
3. Transcript タブを開く（必要なら）
4. Transcript 行をパースして配列化
5. `mux-player` の `timeupdate` を購読し、字幕更新

---

## 13. エッジケース

- Transcript タブが存在しない / DOM構造変更
- Transcript 行のフォーマットが変わる（タイムコードなし、複数行など）
- 動画が読み込めず `currentTime` が取れない
- 早送り/巻き戻し連打、速度変更
- ブラウザ翻訳を OFF → ON にしたときに DOM が差し替わる

---

## 14. テスト計画（最低限）

- 対象ページで字幕が表示される
- 再生・停止・シークで字幕が適切に切り替わる
- Transcript タブを閉じた状態でも動作開始できる（自動展開）
- Chrome の「翻訳ON」で日本語字幕として表示される（innerTextベース）
- ページをリロードしても安定

---

## 15. 未確定事項（実装前に確定する）

- Transcript DOM セレクタ
  - タブボタン要素の特定方法
  - 行要素（時刻・本文）の特定方法
- 字幕挿入位置（ミニプレイヤー化時の見え方含む）
- 初回表示ルール（動画未再生時に何を出すか）

---

## 16. 今後の拡張案

- ミニプレイヤー（スクロール固定）にも字幕を追従表示
- Transcript の現在行をハイライト（ページ内の Transcript UI も同期）
- 2行表示（次行予告）
- オフラインキャッシュ（同一レッスンの Transcript を localStorage に保存）
