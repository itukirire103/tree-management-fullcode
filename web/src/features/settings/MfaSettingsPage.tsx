import { useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";

type SetupResponse = { secret: string; otpauthUrl: string; qrCodeDataUrl: string };

export function MfaSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<SetupResponse>("/auth/mfa/setup");
      setSetup(res.data);
    } catch {
      setError("セットアップの開始に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/mfa/verify", { code });
      setSetup(null);
      setCode("");
      setMessage("多要素認証を有効化しました。");
      await refreshUser();
    } catch {
      setError("認証コードが正しくありません。");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/mfa/disable", { code });
      setCode("");
      setMessage("多要素認証を無効化しました。");
      await refreshUser();
    } catch {
      setError("認証コードが正しくありません。");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mfa-settings-page">
      <h1>多要素認証(MFA)</h1>
      <p className="page-description">
        Google Authenticator等のTOTP対応認証アプリを使い、ログイン時にパスワードに加えて6桁のコード入力を必須にします。
      </p>

      {message && <p className="form-success">{message}</p>}

      {user.mfaEnabled && !setup && (
        <div className="mfa-card">
          <p>現在、多要素認証は有効です。</p>
          <label>
            無効化するには、認証アプリの現在のコードを入力してください
            <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="button" onClick={disable} disabled={busy || !code}>
            無効化する
          </button>
        </div>
      )}

      {!user.mfaEnabled && !setup && (
        <div className="mfa-card">
          <p>現在、多要素認証は無効です。</p>
          <button type="button" onClick={startSetup} disabled={busy}>
            設定を開始する
          </button>
        </div>
      )}

      {setup && (
        <div className="mfa-card">
          <p>認証アプリでこのQRコードを読み取ってください。</p>
          <img src={setup.qrCodeDataUrl} alt="TOTP QRコード" width={200} height={200} />
          <p className="mfa-secret">
            読み取れない場合はこのキーを手入力: <code>{setup.secret}</code>
          </p>
          <label>
            表示された6桁のコードを入力して確認
            <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="button" onClick={verify} disabled={busy || !code}>
              確認して有効化
            </button>
            <button
              type="button"
              onClick={() => {
                setSetup(null);
                setCode("");
                setError(null);
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
