#!/bin/bash
echo "========================================"
echo "  FDSO ナレッジベース 起動中..."
echo "========================================"
echo ""

# node_modules が無ければ npm install を実行
if [ ! -d "node_modules" ]; then
    echo "[1/2] パッケージをインストールしています..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "エラー: npm install に失敗しました。"
        echo "Node.js がインストールされているか確認してください。"
        echo "https://nodejs.org/ja/"
        exit 1
    fi
    echo "インストール完了。"
    echo ""
fi

# .env ファイルが無い場合は .env.example からコピー
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "[情報] .env ファイルが見つかりません。"
    echo ".env.example をコピーして .env を作成します。"
    cp .env.example .env
    echo "AI機能を使う場合は .env ファイルに API_KEY を設定してください。"
    echo "会議スケジューラーはAPIキーなしで使用できます。"
    echo ""
fi

echo "[2/2] アプリを起動しています..."
echo ""
echo "起動後、ブラウザで http://localhost:5173 を開いてください。"
echo "終了するには Ctrl+C を押してください。"
echo ""
npm run dev
