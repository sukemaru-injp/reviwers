# Mermaid Reviewer

Deno Desktop で構築する Mermaid 図レビュー用アプリケーションです。Markdown
ファイルに含まれる Mermaid ブロックを抽出して図として確認したり、直接 Mermaid
を書きながらライブプレビューできます。

## Requirements

- Deno v2.9.0 以上
- `deno desktop` が利用できる環境

## Quick Start

リポジトリを clone して、ルートで `deno task desktop`
を実行すればデスクトップアプリとして使い始められます。

```sh
git clone <repository-url>
cd reviwers
deno task desktop
```

初回起動時は、`deno.json` に固定された npm 依存を Deno が取得します。
`deno task desktop` は build と Deno Desktop 起動をまとめた標準コマンドです。
`deno desktop` を直接使う場合は、先に `deno task build` を実行し、entrypoint
として `desktop.ts` を指定してください。

```sh
deno task build
deno desktop --allow-read --include=./dist --output ./build/MermaidReviewer.app desktop.ts
```

CLIとして使いたい場合は、グローバルコマンド `reviwers` をインストールできます。

```sh
deno task install:cli
```

インストール後は任意のディレクトリから起動できます。

```sh
reviwers .
reviwers ./SAMPLE.md
```

引数には Markdown ファイル、または Markdown
ファイルを含むディレクトリを指定できます。ディレクトリを指定した場合は、その中の最初の
`.md` / `.markdown` ファイルを起動時に読み込みます。 macOSでは `reviwers` が
`./build/MermaidReviewer.app` を生成した後、`open` でアプリを起動します。

## 目的

- Markdown 内の複数 Mermaid ブロックを素早く切り替えて確認する
- Mermaid を直接編集しながらレンダリング結果を確認する
- 図をズーム、ピンチ、ドラッグ移動しながらレビューする
- 将来的に右側へ LLM チャット領域を追加し、ローカル API Key
  を使ったレビュー支援を行う

## 想定 UI

画面は大きく左右 2 ペインで構成します。

- 左ペイン: 画面幅の約 1/3
  - `Files` タブ: Markdown ファイルを選択し、含まれる Mermaid
    コードブロックを一覧化して切り替える
  - `Files` タブ: Markdown ファイルのドラッグ&ドロップにも対応
  - `Write` タブ: Mermaid を直接入力し、ライブプレビューする
- 右ペイン: 画面幅の約 2/3
  - 選択中または編集中の Mermaid を図として表示
  - ズーム、ピンチ、パン操作に対応
- タイトル右側
  - カラースキーマを切り替える設定メニューを配置

将来拡張では、右側または補助ペインに LLM チャット領域を追加します。

## 技術方針

現時点では、Deno の標準的な TypeScript 実行環境をベースにし、UI は Web
技術で構築します。

- Runtime: Deno
- Desktop shell: Deno Desktop / WebView 系の構成を前提
- UI: Preact + Vite
- Mermaid rendering: `mermaid`
- Pan / zoom: 初期実装は Pointer Events。複雑化したら軽量ライブラリを検討
- Markdown parsing: `unified` +
  `remark-parse`、またはコードフェンス抽出に特化した軽量実装
- Local file access: Deno 側 API で Markdown を読み込み、フロントエンドへ渡す
- LLM chat: 将来、ローカル設定の API Key を Deno 側で扱い、UI
  側には秘匿値を直接露出しない

UI ライブラリは、初期実装では大きなコンポーネントフレームワークを入れず、Preact
と CSS Modules または素の CSS で進めます。必要に応じて `preact/compat` で React
向けライブラリを利用します。レビュー用途のツールなので、装飾よりも密度、視認性、操作の速さを優先します。

## 開発コマンド

デスクトップアプリとして起動する場合:

```sh
deno task desktop
```

`deno task desktop` は Vite の production build を作成してから、`desktop.ts` を
entrypoint として Deno Desktop を起動します。Deno Desktop
のフレームワーク自動検出は experimental なので、このプロジェクトでは明示的な
entrypoint を標準ルートにしています。`deno desktop` 単体ではなく、
`deno task desktop` を使ってください。 出力先は `./build/MermaidReviewer.app`
に固定し、Deno Desktop のデフォルト出力名との衝突を避けます。
CLIインストール時は、内部で `deno` と macOS の `open` コマンドを実行するため、
`--allow-run=deno,open` を付与します。

開発・検証では以下も利用できます。

```sh
deno task dev
deno task build
deno task preview
deno task desktop:hmr
deno task install:cli
deno test
```

現在のUIは Vite で構築します。ルートの `index.html` と `vite.config.ts`
で通常のVite開発を行い、Deno Desktop起動時は `desktop.ts` が `dist/`
をローカルHTTPで配信します。`cli.ts` は `reviwers .`
のようなコマンド起動用の薄いラッパーで、Vite build 後に `desktop.ts` を
entrypoint として Deno Desktop を起動します。
デスクトップ起動時の初期ウィンドウサイズは `1100x760` に設定しています。

Preact、Mermaid、lucide-preact、Vite などの依存は `deno.json` の `imports`
でバージョン固定します。`package.json` は Deno Desktop / Vite
検出用の最小メタデータと npm
互換スクリプトだけを持ち、依存バージョンは置きません。

## ドキュメント

- [FEATURE.md](./FEATURE.md): 仕様整理
- [PLAN.md](./PLAN.md): 実装計画
- [SAMPLE.md](./SAMPLE.md): 動作確認用 Mermaid サンプル
