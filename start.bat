@echo off
chcp 65001 > nul
echo ========================================
echo   FDSO ナレッジベース 起動中...
echo ========================================
echo.

:: node_modules が無ければ npm install を実行
if not exist "node_modules" (
    echo [1/2] パッケージをインストールしています...
    npm install
    if errorlevel 1 (
        echo.
        echo エラー: npm install に失敗しました。
        echo Node.js がインストールされているか確認してください。
        echo https://nodejs.org/ja/
        pause
        exit /b 1
    )
    echo インストール完了。
    echo.
)

:: .env ファイルが無い場合は .env.example からコピー
if not exist ".env" (
    if exist ".env.example" (
        echo [情報] .env ファイルが見つかりません。
        echo .env.example をコピーして .env を作成します。
        copy ".env.example" ".env" > nul
        echo AI機能を使う場合は .env ファイルに API_KEY を設定してください。
        echo 会議スケジューラーはAPIキーなしで使用できます。
        echo.
    )
)

echo [2/2] アプリを起動しています...
echo.
echo 起動後、ブラウザで http://localhost:5173 を開いてください。
echo 終了するには Ctrl+C を押してください。
echo.
npm run dev

pause
