# FDSO ナレッジベース & 会議スケジューラー

社内ナレッジ管理・AI対話・会議調整を一元化したWebアプリです。
**GitHub Codespaces** を使えばインストール不要でブラウザだけで使用できます。

---

## 機能一覧

| 機能 | 説明 | APIキー |
|------|------|---------|
| ダッシュボード | 登録件数の確認・クイックナビ | 不要 |
| **会議スケジューラー** | 打診メール生成・Googleカレンダーリンク作成 | **不要** |
| ナレッジ管理 | 社内文書のCRUD管理・AI解析 | 必要 |
| 対話型マニュアル | ナレッジベースへのAI質問 | 必要 |

> **会議スケジューラーだけを使いたい場合はAPIキー不要です。**

---

## 🚀 GitHub Codespaces で使う（推奨・インストール不要）

Node.js のインストールなど一切不要。ブラウザだけで使えます。

1. GitHubリポジトリ上部の「**Code**」ボタンをクリック
2. 「**Codespaces**」タブ → 「**Create codespace on main**」をクリック
3. しばらく待つと自動でアプリが起動し、ブラウザが開きます

> AI機能を使う場合は、Codespaces の「**Secrets**」に `API_KEY` を設定してください。
> リポジトリ設定 → Codespaces → Secrets から追加できます。

---

## ローカルPCで使う場合のセットアップ手順

### 1. Node.js のインストール（初回のみ）

[https://nodejs.org/ja/](https://nodejs.org/ja/) から **LTS版** をダウンロードしてインストールしてください。
インストール後、コマンドプロンプト（Windows）またはターミナル（Mac）で以下を実行して確認します。

```
node -v
```

`v18.x.x` 以上が表示されれば OK です。

---

### 2. このリポジトリを取得

**Git を使う場合：**
```
git clone https://github.com/fujiwara3737/congenial-bassoon.git
cd congenial-bassoon
```

**Git を使わない場合：**
GitHubページから「Code → Download ZIP」でダウンロードして解凍してください。

---

### 3. 依存パッケージのインストール

プロジェクトフォルダに移動して実行：
```
npm install
```

---

### 4. APIキーの設定（AI機能を使う場合のみ）

会議スケジューラーのみ使う場合はこの手順は不要です。

1. `.env.example` ファイルをコピーして `.env` という名前で保存
2. `.env` ファイルをテキストエディタで開き、APIキーを記入：

```
API_KEY=ここにGemini APIキーを貼り付け
```

Gemini APIキーは [Google AI Studio](https://aistudio.google.com/app/apikey) から無料で取得できます。

---

### 5. アプリの起動

#### Windows の場合
`start.bat` をダブルクリックするか、コマンドプロンプトで：
```
start.bat
```

#### Mac / Linux の場合
ターミナルで：
```
./start.sh
```

または直接：
```
npm run dev
```

起動後、ブラウザで **http://localhost:5173** を開いてください。

---

## 起動確認

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

上記が表示されたらアクセス可能です。
アプリを終了するには `Ctrl + C` を押してください。

---

## トラブルシューティング

| 症状 | 対処法 |
|------|--------|
| `node: command not found` | Node.js をインストールしてください |
| `npm install` でエラー | Node.js を再インストールするか、バージョンを確認してください |
| ページが開かない | ブラウザで `http://localhost:5173` にアクセスしてください |
| AI機能が動かない | `.env` の `API_KEY` が正しく設定されているか確認してください |
| ポート5173が使えない | `npm run dev -- --port 3000` で別ポートを指定できます |
