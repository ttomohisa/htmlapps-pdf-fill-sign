# PDF Fill & Sign / PDF記入・署名

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-pdf-fill-sign/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-pdf-fill-sign/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-pdf-fill-sign/)

[English README](README.md)

PDFを外部へアップロードせず、既存の入力欄へ記入し、文字・日付・マーク・署名・イニシャル・印影画像などを追加して、完成したPDFをブラウザー内だけで作成・保存するBrowser Kittyアプリです。

## 🚀 デモ

### [GitHub PagesでPDF Fill & Signを開く](https://ttomohisa.github.io/htmlapps-pdf-fill-sign/)

GitHub Pagesから最初のHTMLを読み込んだ後、PDFの解析、フォーム入力、追加要素の編集、署名、画像配置、PDF生成は端末内で処理します。選択したPDFをアプリがサーバーへアップロードすることはありません。

## 主な機能

- **既存PDFフォームへ入力** — AcroFormの1行テキスト、複数行、チェックボックス、ラジオボタン、ドロップダウン、選択リストなどに対応します。
- **好きな位置へ追加** — 文字、日付、✓ / × / ○、手書き署名、イニシャル、PNG / JPEG / WebP画像をPDF上へ配置できます。
- **追加内容を可能な範囲でベクター保存** — 文字・日付はPDF FreeText注釈、✓ / × / ○と新しく描いた署名・イニシャルはベクターInk注釈として保存します。
- **画像は画像のまま保存** — アップロードした署名画像、印影、写真、ロゴなどはラスター画像注釈として保存します。
- **PC / スマホ対応** — サムネイル、拡大縮小、`Ctrl/Cmd + ホイール`、1本指Pan、2本指Pinch Zoom、スマホ下部固定アクションに対応します。
- **Undo / Redo** — Browser Kittyで追加した項目と対応フォーム値の変更を戻す・やり直すことができます。
- **完成PDFを別名保存** — 元PDFを上書きせず、`-filled.pdf` を付けた完成PDFとして保存します。
- **完全ローカル処理・単一HTML** — PDF.jsとWorkerを内包し、`connect-src 'none'`で実行時通信を遮断します。登録も不要です。

## すぐ使う

### Web版

GitHub Pagesのデモを開き、PDFを選択して記入・署名し、「PDFを保存」から完成PDFを作成します。インストールやアカウントは不要です。

### 単一HTML版

リポジトリを一度ビルドすると、`dist/index.html` と `dist/index.self-extract.html` が生成されます。生成HTMLは実行時の外部通信を必要とせず、`file://` から直接開く利用も想定しています。

## 使い方

1. PDFを1件開きます。PCでは開始画面へのDrag & Dropにも対応します。
2. PDFに対応フォーム欄がある場合は、その欄へ直接入力します。`Tab` / `Shift+Tab` または前後ボタンで入力欄を移動できます。
3. **文字**、**日付**、**✓**、**×**、**○** を使うと、フォーム以外の位置にも内容を追加できます。
4. **署名** または **イニシャル** でマウス・指・ペンによる手書き、または画像の選択ができます。
5. **画像・印影** からPNG / JPEG / WebP画像を配置できます。
6. Browser Kittyで追加した項目を選択すると、移動、リサイズ、内容変更、削除ができます。文字・日付は1種類のローカルSans-serif系フォントで表示し、文字サイズと色を変更できます。
7. **PDFを保存** を押します。見た目を固定した完成版にする場合は **入力内容を固定する** をONのまま、入力欄を残したい場合はOFFにします。
8. 生成されたPDFを保存します。元PDFは上書きしません。

### キーボード操作

| ショートカット | 操作 |
| --- | --- |
| `Tab` / `Shift + Tab` | 次 / 前の対応フォーム入力欄へ移動 |
| `Ctrl` / `⌘` + `Z` | 入力欄へ入力中でない場合にUndo |
| `Ctrl` / `⌘` + `Shift` + `Z` または `Ctrl` / `⌘` + `Y` | Redo |
| `Ctrl` / `⌘` + ホイール | カーソル位置を基準にPDFを拡大・縮小 |
| `Delete` / `Backspace` | 入力中でない場合に選択中の追加項目を削除 |
| `Esc` | 選択・現在ツールを解除 |
| 矢印キー | 選択項目を移動 |
| `Shift` + 矢印 | 選択項目を大きく移動 |

## PDFフォームと「入力内容を固定する」

対応フォームは、1行テキスト、複数行、チェックボックス、ラジオボタン、ドロップダウン / 選択リスト、読み取り専用欄、視覚署名の配置案内としての署名欄です。

**入力内容を固定する** は既定でONです。対応フォーム欄の現在値をその位置へ見た目として書き込み、元のWidgetを表示・印刷しない状態にします。これは見た目を固定して操作できなくする方式で、PDF内部のAcroFormフィールド辞書そのものを物理的に削除する処理ではありません。

OFFの場合は、元PDFとPDF.jsの保存経路で保持できる範囲でフォーム欄を編集可能なまま保存します。

## プライバシーと外部通信

PDF、フォーム入力値、署名、画像、編集内容はブラウザー内で処理します。選択したPDFのアップロード、アクセス解析、telemetry、CDN、外部Webフォント、外部APIは使用しません。

生成HTMLのContent Security Policyには `connect-src 'none'` を設定し、PDF.jsとWorkerはビルド時にHTMLへ内包します。

選択したPDFと編集中の内容は永続保存しません。署名またはイニシャルは **この端末に保存する** を明示的にONにした場合だけIndexedDBへ保存し、署名ダイアログから削除できます。言語設定も端末内に保存される場合があります。

## スマートフォン

スマートフォンでは画面下部に **ツール / ページ / 選択項目 / 保存** を固定表示します。**選択項目** はBrowser Kittyで追加した項目を選んだときだけ有効になります。

PDF表示は1本指で移動し、2本指ピンチで拡大・縮小できます。署名・保存ダイアログはviewportとsafe areaを考慮し、縦が短い画面や横向きでも内部スクロールして操作できます。

## 制限事項

- 一度に扱うPDFは1件
- 入力上限は100 MiB
- パスワード付きPDFはまだ開かない
- XFAフォームの既存入力欄は編集しない。ただし文字・署名などをページ上へ追加可能
- PDFの署名欄を証明書付きの暗号署名欄として署名済みにしない。Browser Kittyの署名は視覚的な署名
- 証明書署名、本人確認、署名依頼、監査証跡、契約管理は対象外
- 必須欄の警告は案内のみで、PDF保存をブロックしない
- 文字・日付はPDF FreeText注釈だが、Browser Kitty独自の日本語フォントファイルをPDFへ埋め込む処理は行わない
- アップロードした署名画像、印影、写真、ロゴ、PNG / JPEG / WebPなどの画像系はラスター
- 固定化は元フォームWidgetを非表示・非印刷化して見た目を書き込む方式で、AcroFormオブジェクト自体は削除しない

## ブラウザー

主対象は現行Chrome / Edgeです。Firefox / Safari / iOS Safari / Android Chromiumも互換対象とします。

## 開発・ビルド構成

```text
.
├─ src/index.template.html       # アプリ本体テンプレート
├─ dependencies.json             # 依存ライブラリ宣言
├─ dependencies.lock.json        # 依存固定情報
├─ build-standalone.bat          # Windowsビルド入口
├─ build-standalone.ps1          # 単一HTMLビルダー
├─ assets/favicon.svg
└─ .github/workflows/
   ├─ build-standalone.yml       # Build / 検証
   └─ deploy-pages.yml           # GitHub Pages配信
```

## ビルド

Windows PowerShell 7:

```powershell
./build-standalone.ps1
./scripts/check-repository.ps1
```

生成物は `dist/` に出力されます。生成HTMLを直接編集しません。

## 依存ライブラリ

| ライブラリ | バージョン | ライセンス | 用途 |
| --- | ---: | --- | --- |
| PDF.js / `pdfjs-dist` | 6.3.289 | Apache-2.0 | PDF読み込み、描画、フォーム、注釈、保存 |

ライセンス詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

## Contributing

不具合報告や機能提案はGitHub Issuesで受け付けます。開発時は [CONTRIBUTING.md](CONTRIBUTING.md) も参照してください。

## License

Copyright © 2026 ttomohisa

[MIT License](LICENSE) で公開します。
