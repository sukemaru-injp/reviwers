# Implementation Plan

## 方針

Deno Desktop 上で動く Mermaid レビューアとして、まずはファイル読み込み、Mermaid
抽出、ライブプレビュー、ズーム / パンを確実に実装します。LLM
チャットは後続で追加できるよう、Deno 側 API と UI
状態の境界を早い段階で整理します。

## 技術選定

### 採用候補

- Deno: アプリの実行基盤
- Deno Desktop / WebView: デスクトップ表示
- Preact: UI 実装
- Vite: フロントエンド開発環境
- Mermaid: Mermaid 定義のレンダリング
- Pointer Events: 初期実装のズーム、ピンチ、パン操作

### 判断

初期実装では Preact + Vite
を採用します。理由は、タブ、エディタ、プレビュー、将来のチャット領域をコンポーネントとして分割しやすく、Deno
Desktop の WebView 用途では軽量さの利点も大きいためです。Deno Desktop
のフレームワーク検出にも合わせ、ルートに `index.html` と `vite.config.ts`
を置きます。実際のデスクトップ起動は、検出の揺れを避けるため `desktop.ts`
を明示的な entrypoint にします。React 向けライブラリが必要になった場合は
`preact/compat` を使い、互換性を確認してから導入します。

エディタは初期段階では `textarea`
から始めます。構文ハイライトや補完が必要になった時点で CodeMirror
の導入を検討します。

Markdown 解析は、まず fenced code block の Mermaid 抽出に集中します。Markdown
仕様への追従が必要になった時点で `unified` / `remark-parse` を導入します。

## 実装ステップ

### 1. プロジェクト整理

- [x] README.md を作成する
- [x] FEATURE.md を作成する
- [x] PLAN.md を作成する
- [x] Deno Desktop の起動方式を確認する
- [x] フロントエンド構成を追加する
- [x] `deno task dev` の役割を整理する
- [x] ブラウザ依存を `deno.json` の import map でバージョン固定する
- [x] Vite 構成へ移行して `deno desktop` の検出対象にする
- [x] `desktop.ts` を追加して明示的な Deno Desktop entrypoint を用意する
- [x] `cli.ts` を追加して `reviwers .` 形式のCLI起動を用意する

### 2. UI 土台

- [x] 左右 2 ペインレイアウトを作る
- [x] 左ペインに `Files` / `Write` タブを作る
- [x] 右ペインに Mermaid プレビュー領域を作る
- [x] レスポンシブ時の最小幅とスクロール挙動を決める

### 3. Write タブ

- [x] Mermaid 入力用 textarea を作る
- [x] 入力内容をライブでプレビューへ反映する
- [x] 初期サンプル Mermaid を用意する
- [x] Mermaid 構文エラーを表示する

### 4. Mermaid レンダリング

- [x] `mermaid` を導入する
- [x] Mermaid ソースから SVG を生成する
- [x] レンダリング失敗時のエラー状態を整える
- [x] 再レンダリング時の DOM 更新を安定させる

### 5. Files タブ

- [x] Markdown ファイル選択 UI を作る
- [x] ブラウザ File API で Markdown を読み込む
- [x] Mermaid コードブロック抽出処理を作る
- [x] 抽出結果一覧を表示する
- [x] 選択されたブロックをプレビューへ反映する

### 6. ズーム / パン

- [x] Pointer Events ベースのズーム / パンを実装する
- [x] マウスホイールでズームできるようにする
- [x] ピンチでズームできるようにする
- [x] ドラッグでパンできるようにする
- [x] 表示リセットボタンを作る

### 7. LLM チャットの準備

- [ ] 将来のチャット領域を追加しやすいレイアウト余地を確認する
- [ ] API Key を Deno 側で扱う設計にする
- [ ] Mermaid ソースとメタデータをチャット文脈として渡せる構造にする
- [ ] チャット実装は初期リリース対象外として分離する

### 8. 設定メニュー

- [x] タイトルセクション右側へ設定メニューを追加する
- [x] カラースキーマを複数用意する
- [x] 選択されたカラースキーマをUIへ反映する
- [x] `lucide-preact` のアイコンを使う

### 9. 品質確認

- [x] Mermaid 抽出のユニットテストを追加する
- [x] レンダリング失敗時の表示を確認する
- [x] Markdown に Mermaid ブロックがないケースを確認する
- [x] 複数 Mermaid ブロックの切り替えを確認する
- [x] `deno test` を通す

## ディレクトリ案

実装時は次のような構成を候補にします。

```text
.
├── index.html
├── vite.config.ts
├── package.json
├── deno.json
├── desktop.ts
├── cli.ts
├── src/
│   ├── app/
│   │   ├── app.js
│   │   └── styles.css
│   ├── domain/
│   │   └── mermaidBlocks.ts
├── README.md
├── FEATURE.md
└── PLAN.md
```

## 実装上の注意

- API Key やローカル設定値をフロントエンドに直接露出しない
- Mermaid のレンダリング結果は信頼しすぎず、DOM 挿入箇所を限定する
- ファイル読み込みはユーザーが選択した Markdown に限定する
- UI はレビュー作業向けに、情報密度と操作のわかりやすさを優先する
