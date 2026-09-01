import { useAzureMonitor } from "applicationinsights";

// index.tsの最初の行でimportする(他のモジュール読み込みより前に計装を有効化する必要があるため)。
// APPLICATIONINSIGHTS_CONNECTION_STRING未設定の環境(ローカル開発・Render等)では
// 何もしない。Azure App Service側でのみこの環境変数を設定している。
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  useAzureMonitor();
}
