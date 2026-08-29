import { useState, type FormEvent } from "react";
import axios from "axios";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, mfaRequired ? totpCode : undefined);
      navigate("/", { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const data = err.response.data as { error?: string; mfaRequired?: boolean };
        if (data.mfaRequired) {
          setMfaRequired(true);
          setError(mfaRequired ? "認証コードが正しくありません。" : null);
        } else {
          setError("メールアドレスまたはパスワードが違います。");
        }
      } else {
        setError("ログインに失敗しました。");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>樹木管理システム</h1>
        {!mfaRequired ? (
          <>
            <label>
              メールアドレス
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label>
              パスワード
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          </>
        ) : (
          <label>
            認証アプリの6桁コード
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              required
              autoFocus
            />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "処理中..." : mfaRequired ? "認証コードを確認" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
