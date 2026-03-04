#!/usr/bin/env node
/**
 * FDSO – Google Calendar API セットアップウィザード
 *
 * このスクリプトは以下を自動で行います:
 *   1. GCP プロジェクトの選択/作成
 *   2. Google Calendar API の有効化
 *   3. OAuth 同意画面の作成
 *   4. OAuth クライアント ID の作成
 *   5. .env ファイルへの書き込み
 *
 * 使い方: node scripts/setup-google.mjs
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── パス設定 ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

// ─── 色付きコンソール出力 ──────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};
const ok = (msg) => console.log(`${c.green}✓${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}⚠${c.reset} ${msg}`);
const err = (msg) => console.log(`${c.red}✗${c.reset} ${msg}`);
const step = (n, title) =>
  console.log(`\n${c.bold}${c.blue}[STEP ${n}]${c.reset}${c.bold} ${title}${c.reset}`);
const divider = () => console.log(`${c.gray}${'─'.repeat(60)}${c.reset}`);
const url = (u) => `${c.cyan}${c.bold}${u}${c.reset}`;

// ─── readline ヘルパー ────────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) =>
  new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
const pressEnter = () => ask(`${c.gray}準備できたら Enter を押してください...${c.reset}`);

// ─── .env 読み書き ────────────────────────────────────────────────────────────
const readEnv = () => {
  if (!existsSync(ENV_PATH)) return {};
  const lines = readFileSync(ENV_PATH, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const [k, ...rest] = line.split('=');
    if (k && !k.startsWith('#')) env[k.trim()] = rest.join('=').trim();
  }
  return env;
};

const writeEnv = (updates) => {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  writeFileSync(ENV_PATH, content.trimStart());
};

// ─── googleapis の動的インポート ─────────────────────────────────────────────
let google;
try {
  const mod = await import('googleapis');
  google = mod.google;
} catch {
  err('googleapis パッケージが見つかりません。先に npm install を実行してください。');
  process.exit(1);
}

// ─── OAuth 2.0 ローカルサーバーフロー ─────────────────────────────────────
const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const CLOUD_SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'openid',
  'email',
].join(' ');

/**
 * Desktop アプリ用 OAuth クライアントで認証を行い、アクセストークンを返す。
 * ローカルの HTTP サーバーでリダイレクトを受け取る。
 */
async function authenticateWithClient(clientId, clientSecret, scope) {
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope,
    prompt: 'consent',
  });

  console.log(`\n${c.bold}ブラウザで以下の URL を開いてください:${c.reset}`);
  console.log(url(authUrl));
  console.log();

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const parsed = new URL(req.url, `http://localhost:${PORT}`);
      if (parsed.pathname !== '/callback') {
        res.end('Not found');
        return;
      }
      const code = parsed.searchParams.get('code');
      if (!code) {
        res.end('エラー: 認証コードが見つかりません。やり直してください。');
        server.close();
        reject(new Error('No auth code'));
        return;
      }
      res.end('<h2>認証完了 ✓</h2><p>このタブを閉じてターミナルに戻ってください。</p>');
      server.close();
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        resolve(oAuth2Client);
      } catch (e) {
        reject(e);
      }
    });
    server.listen(PORT, '127.0.0.1');
  });
}

// ─── API 有効化 ───────────────────────────────────────────────────────────────
async function enableApi(auth, projectId, apiName) {
  const serviceusage = google.serviceusage({ version: 'v1', auth });
  const name = `projects/${projectId}/services/${apiName}`;
  try {
    const { data } = await serviceusage.services.get({ name });
    if (data.state === 'ENABLED') {
      ok(`${apiName} は既に有効です`);
      return;
    }
  } catch {
    /* API が見つからない場合も enable を試みる */
  }
  info(`${apiName} を有効化しています...`);
  const op = await serviceusage.services.enable({ name, requestBody: {} });
  // 完了を待機（最大 30 秒）
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const { data } = await serviceusage.services.get({ name });
      if (data.state === 'ENABLED') {
        ok(`${apiName} を有効化しました`);
        return;
      }
    } catch {}
  }
  warn(`${apiName} の有効化状態を確認できませんでした（コンソールで確認してください）`);
}

// ─── プロジェクト一覧 ─────────────────────────────────────────────────────────
async function listProjects(auth) {
  const rm = google.cloudresourcemanager({ version: 'v1', auth });
  const { data } = await rm.projects.list({ filter: 'lifecycleState:ACTIVE' });
  return data.projects ?? [];
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  divider();
  console.log(`${c.bold}${c.blue} FDSO – Google Calendar API セットアップウィザード${c.reset}`);
  divider();
  console.log('このウィザードが Google Cloud の設定を自動で行います。');
  console.log('所要時間: 約 10〜15 分\n');

  const existingEnv = readEnv();
  if (
    existingEnv.VITE_GOOGLE_CLIENT_ID &&
    !existingEnv.VITE_GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE')
  ) {
    warn('VITE_GOOGLE_CLIENT_ID がすでに .env に設定されています。');
    const cont = await ask('再設定しますか？ (y/N): ');
    if (!cont.toLowerCase().startsWith('y')) {
      ok('設定済みです。終了します。');
      rl.close();
      return;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  step(1, 'Google Cloud プロジェクトの準備');
  // ────────────────────────────────────────────────────────────────────────────
  divider();
  console.log(`
まだ GCP プロジェクトを持っていない場合は以下から作成してください:
  ${url('https://console.cloud.google.com/projectcreate')}

すでにプロジェクトがある場合はそのまま次に進んでください。
`);
  await pressEnter();

  // ────────────────────────────────────────────────────────────────────────────
  step(2, 'Desktop アプリ用 OAuth クライアントの一時作成（認証用）');
  // ────────────────────────────────────────────────────────────────────────────
  divider();
  console.log(`
スクリプトが GCP を操作するための一時的な認証情報が必要です。
以下の手順でデスクトップアプリ用 OAuth クライアントを作成してください:

  1. ${url('https://console.cloud.google.com/apis/credentials')} を開く
  2.「認証情報を作成」→「OAuth クライアント ID」
  3. アプリの種類:「デスクトップ アプリ」を選択
  4. 名前:「FDSO Setup」（任意）→「作成」
  5. 表示されたクライアント ID とクライアント シークレットをコピー

${c.yellow}注意: このクライアントは後で削除して構いません（本番用は別で作成します）${c.reset}
`);
  info(
    '先に OAuth 同意画面を設定する必要があります:\n' +
    `  ${url('https://console.cloud.google.com/apis/credentials/consent')}\n` +
    `  User Type:「外部」→「作成」\n` +
    `  アプリ名・サポートメールを入力 →「保存して次へ」（スコープは後で追加）\n` +
    `  テストユーザーに自分のGoogleアカウントを追加する`,
  );
  console.log();

  const setupClientId = await ask(
    `${c.bold}デスクトップアプリのクライアント ID を貼り付けてください:${c.reset} `,
  );
  const setupClientSecret = await ask(
    `${c.bold}クライアント シークレットを貼り付けてください:${c.reset} `,
  );

  if (!setupClientId || !setupClientSecret) {
    err('クライアント ID とシークレットが必要です。');
    rl.close();
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────────────────────
  step(3, 'Google アカウントで認証（ブラウザが開きます）');
  // ────────────────────────────────────────────────────────────────────────────
  divider();
  info(`ポート ${PORT} でコールバックを待機します...`);

  let auth;
  try {
    auth = await authenticateWithClient(setupClientId, setupClientSecret, CLOUD_SCOPE);
    ok('認証成功！');
  } catch (e) {
    err(`認証に失敗しました: ${e.message}`);
    rl.close();
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────────────────────
  step(4, 'GCP プロジェクトの選択');
  // ────────────────────────────────────────────────────────────────────────────
  divider();

  let projects = [];
  try {
    projects = await listProjects(auth);
  } catch (e) {
    warn(`プロジェクト一覧の取得に失敗しました: ${e.message}`);
  }

  let projectId;
  if (projects.length === 0) {
    warn('利用可能なプロジェクトが見つかりませんでした。');
    projectId = await ask(`${c.bold}プロジェクト ID を手動で入力してください:${c.reset} `);
  } else {
    console.log('\n利用可能なプロジェクト:');
    projects.forEach((p, i) => {
      console.log(`  ${c.cyan}[${i + 1}]${c.reset} ${p.name} ${c.gray}(${p.projectId})${c.reset}`);
    });
    const choice = await ask(
      `\n${c.bold}番号を選択するか、プロジェクト ID を直接入力してください:${c.reset} `,
    );
    const idx = parseInt(choice, 10) - 1;
    if (idx >= 0 && idx < projects.length) {
      projectId = projects[idx].projectId;
    } else {
      projectId = choice;
    }
  }

  if (!projectId) {
    err('プロジェクト ID が必要です。');
    rl.close();
    process.exit(1);
  }
  ok(`プロジェクト: ${projectId}`);

  // ────────────────────────────────────────────────────────────────────────────
  step(5, 'Google Calendar API の有効化');
  // ────────────────────────────────────────────────────────────────────────────
  divider();

  try {
    await enableApi(auth, projectId, 'calendar-json.googleapis.com');
  } catch (e) {
    warn(`API 有効化でエラーが発生しました: ${e.message}`);
    warn(
      `手動で有効化してください:\n  ${url(
        `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${projectId}`,
      )}`,
    );
    await pressEnter();
  }

  // ────────────────────────────────────────────────────────────────────────────
  step(6, 'ウェブアプリ用 OAuth クライアント ID の作成');
  // ────────────────────────────────────────────────────────────────────────────
  divider();

  // Detect Codespace URL
  const codespaceUrl = process.env.CODESPACE_NAME
    ? `https://${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? 'app.github.dev'}`
    : null;

  console.log(`
以下の手順でウェブアプリ用 OAuth クライアント ID を作成してください:

  1. ${url(`https://console.cloud.google.com/apis/credentials?project=${projectId}`)} を開く
  2.「認証情報を作成」→「OAuth クライアント ID」
  3. アプリの種類:「ウェブ アプリケーション」を選択
  4. 名前:「FDSO App」（任意）
  5.「承認済みの JavaScript 生成元」に以下を追加:
     ${c.green}• http://localhost:5173${c.reset}${codespaceUrl ? `\n     ${c.green}• ${codespaceUrl}${c.reset}` : ''}
  6.「作成」→ クライアント ID をコピー
`);

  const webClientId = await ask(
    `${c.bold}ウェブアプリのクライアント ID を貼り付けてください:${c.reset} `,
  );

  if (!webClientId || webClientId.length < 20) {
    err('有効なクライアント ID を入力してください。');
    rl.close();
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────────────────────
  step(7, '.env ファイルへの書き込み');
  // ────────────────────────────────────────────────────────────────────────────
  divider();

  // .env が存在しない場合は .env.example からコピー
  if (!existsSync(ENV_PATH)) {
    const examplePath = resolve(ROOT, '.env.example');
    if (existsSync(examplePath)) {
      const exampleContent = readFileSync(examplePath, 'utf8');
      writeFileSync(ENV_PATH, exampleContent);
      ok('.env.example をもとに .env を作成しました');
    }
  }

  writeEnv({ VITE_GOOGLE_CLIENT_ID: webClientId });
  ok(`VITE_GOOGLE_CLIENT_ID を .env に書き込みました`);

  // ────────────────────────────────────────────────────────────────────────────
  divider();
  console.log(`\n${c.bold}${c.green}🎉 セットアップ完了！${c.reset}\n`);
  console.log('次のステップ:');
  console.log(`  1. ${c.bold}npm run dev${c.reset} でアプリを起動`);
  console.log('  2. 会議スケジューラーを開く');
  console.log('  3.「Googleでサインイン」ボタンをクリック');
  console.log(
    `  4. テストユーザーに自分のアカウントを追加済みか確認:\n     ${url(
      `https://console.cloud.google.com/apis/credentials/consent?project=${projectId}`,
    )}`,
  );
  console.log();
  warn(
    'アプリを社内に公開する前に、OAuth 同意画面を「確認済みに公開」してください\n' +
    `  ${url(`https://console.cloud.google.com/apis/credentials/consent?project=${projectId}`)}`,
  );
  console.log();
  divider();

  rl.close();
}

main().catch((e) => {
  err(`予期しないエラー: ${e.message}`);
  process.exit(1);
});
