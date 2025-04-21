import { useState } from "react";
import { createPersistentAnonUser, loginWithEmailAndSecret } from '../api/persistentAnon';
import styles from './LoginScreen.module.css';
import TitleBar from '../TitleBar';
import { getCurrentUser, logout } from '../api/auth';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [userId, setUserId] = useState("");
  const [persistentSecret, setPersistentSecret] = useState("");
  const [showSecretPrompt, setShowSecretPrompt] = useState(false);
  const [savedPersistentSecret, setSavedPersistentSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handler for persistent anonymous login
  const handlePersistentAnonLogin = async () => {
    setError("");
    setLoading(true);
    try {
      // 1. Generate fake email and secret
      // 2. Create Appwrite user with email/secret
      // 3. Log in as that user
      // 4. Store mapping in anon_links
      // 5. Save credentials and show login key
      const { user, secret, email } = await createPersistentAnonUser();
      setUserId(user.$id);
      const loginKey = `${email}:${secret}`;
      setSavedPersistentSecret(loginKey);
      setShowSecretPrompt(true);
      localStorage.setItem('persistentSecret', loginKey);
      localStorage.setItem('persistentUserId', user.$id);
      localStorage.setItem('persistentEmail', email);
      onLogin();
    } catch (e: any) {
      setError(e.message || "Failed to create persistent anonymous user.");
    } finally {
      setLoading(false);
    }
  };

  // Handler for login with persistent secret (now login key)
  const handleLoginWithPersistentSecret = async () => {
    setError("");
    setLoading(true);
    try {
      // Defensive: clear any zombie session before login
      try { await logout(); } catch (logoutErr) { console.warn('Logout before login failed:', logoutErr); }
      const [emailRaw, secretRaw] = persistentSecret.split(":");
      const email = emailRaw?.trim();
      const secret = secretRaw?.trim();
      if (!email || !secret || !email.includes("@")) {
        setError("Invalid login key format. It should be email:secret");
        setLoading(false);
        return;
      }
      console.log('Attempting login with:', { email, secret });
      await loginWithEmailAndSecret(email, secret);
      const user = await getCurrentUser();
      localStorage.setItem('persistentSecret', persistentSecret);
      localStorage.setItem('persistentEmail', email);
      if (user && user.$id) {
        localStorage.setItem('persistentUserId', user.$id);
      }
      console.log('Login successful');
      onLogin();
    } catch (e: any) {
      // On error, clear any session that might have been created
      try { await logout(); } catch (logoutErr) { console.warn('Logout after failed login failed:', logoutErr); }
      setError(e.message || "Login failed. Check your login key.");
      console.error('Login failed:', e);
    } finally {
      setLoading(false);
    }
  };

  function DebugSessionInfo() {
    const [user, setUser] = useState<any>(null);
    const [sessionType, setSessionType] = useState<string>("");
    const [error, setError] = useState<string>("");

    async function refresh() {
      setError("");
      try {
        const u = await getCurrentUser();
        setUser(u);
        if (!u) {
          setSessionType("NO SESSION");
        } else if (u.email && u.email.endsWith('@mlshophelper.local')) {
          setSessionType("PERSISTENT ANON USER");
        } else {
          setSessionType("REGISTERED USER");
        }
      } catch (e: any) {
        setError(e.message || "Unknown error");
        setUser(null);
        setSessionType("");
      }
    }

    async function handleLogout() {
      setError("");
      try {
        await logout();
        await refresh();
      } catch (e: any) {
        setError(e.message || "Logout error");
      }
    }

    return (
      <div style={{ margin: '14px 0', padding: 8, background: '#222', borderRadius: 8, color: '#ccc', fontSize: 13 }}>
        <b>Debug Session Info</b>
        <div>Session Type: <code>{sessionType}</code></div>
        <div>User: <code>{user ? JSON.stringify(user) : 'null'}</code></div>
        <button onClick={refresh} style={{ marginRight: 8 }}>Refresh</button>
        <button onClick={handleLogout} style={{ marginRight: 8 }}>Logout</button>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div className={styles.loginScreenRoot}>
      <TitleBar />
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <img src={"/placeholder-sell.png"} alt="MLShopHelper logo" className={styles.logoIcon} />
          <span className={styles.loginTitle}>MLShopHelper</span>
        </div>
        <DebugSessionInfo />
        <div className={styles.loginContentCenter}>
          <button
            className={styles.loginButton}
            onClick={handlePersistentAnonLogin}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create New Secret Login"}
          </button>
          <hr />
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!loading && persistentSecret) handleLoginWithPersistentSecret();
            }}
            style={{ width: '100%' }}
          >
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="persistent-secret-input">
                Login with Your Login Key:
              </label>
              <input
                id="persistent-secret-input"
                className={styles.loginInput}
                type="password"
                value={persistentSecret}
                onChange={e => setPersistentSecret(e.target.value)}
                placeholder="Paste your login key here (email:secret)"
                disabled={loading}
                autoComplete="off"
              />
            </div>
            <button
              className={styles.loginButton}
              type="submit"
              disabled={loading || !persistentSecret}
            >
              {loading ? "Logging in..." : "Login with Secret"}
            </button>
          </form>
          {showSecretPrompt && (
            <div className={styles.secretPrompt}>
              <b>Save your Login Key!</b>
              <div style={{ margin: '8px 0', wordBreak: 'break-all', background: '#181818', padding: 8, borderRadius: 6 }}>
                <code>{savedPersistentSecret}</code>
              </div>
              <div style={{ color: '#ffb700', fontSize: 13, marginBottom: 6 }}>
                You need this key to log in again. <b>Save it somewhere safe!</b>
              </div>
              <button className={styles.loginButton} onClick={() => setShowSecretPrompt(false)}>
                I have saved my login key
              </button>
            </div>
          )}
          {error && <div className={styles.loginError}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
