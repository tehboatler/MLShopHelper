import { useState } from "react";
import { createPersistentAnonUser, loginWithEmailAndSecret } from '../api/persistentAnon';
import styles from './LoginScreen.module.css';
import TitleBar from '../TitleBar';
import { getCurrentUser, logout } from '../api/auth';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [_, setUserId] = useState("");
  const [persistentSecret, setPersistentSecret] = useState("");
  const [showSecretPrompt, setShowSecretPrompt] = useState(false);
  const [savedPersistentSecret, setSavedPersistentSecret] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");

  // Handler for persistent anonymous login
  const handlePersistentAnonLogin = async () => {
    setError("");
    setCreating(true);
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
      setCreating(false);
    }
  };

  // Handler for login with persistent secret (now login key)
  const handleLoginWithPersistentSecret = async () => {
    setError("");
    setLoggingIn(true);
    try {
      // Defensive: clear any zombie session before login
      try { await logout(); } catch (logoutErr) { console.warn('Logout before login failed:', logoutErr); }
      const [emailRaw, secretRaw] = persistentSecret.split(":");
      const email = emailRaw?.trim();
      const secret = secretRaw?.trim();
      if (!email || !secret || !email.includes("@")) {
        setError("Invalid login key format. It should be email:secret");
        setLoggingIn(false);
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
      setLoggingIn(false);
    }
  };

  // --- Copy login key to clipboard ---
  const handleCopyLoginKey = async () => {
    try {
      await navigator.clipboard.writeText(savedPersistentSecret);
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(""), 1600);
    } catch {
      setCopySuccess("Copy failed");
      setTimeout(() => setCopySuccess(""), 1600);
    }
  };

  return (
    <div>
      <div className={styles.animatedBg} aria-hidden="true"></div>
      <div className={styles.loginScreenRoot}>
        <TitleBar />
        <div className={styles.loginScreenFlexRow}>
          <div className={styles.loginCard}>
            <div className={styles.loginHeader}>
              <img src={"/placeholder-sell.png"} alt="MLShopHelper logo" className={styles.logoIcon} />
              <span className={styles.loginTitle}>MLShopHelper</span>
            </div>
            {/* <DebugSessionInfo /> */}
            <div className={styles.loginContentCenter}>
              <button
                className={styles.loginButton}
                onClick={handlePersistentAnonLogin}
                disabled={creating || loggingIn}
              >
                {creating ? "Creating..." : "Create New Secret Login"}
              </button>
              <hr />
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!loggingIn && persistentSecret) handleLoginWithPersistentSecret();
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
                    disabled={loggingIn || creating}
                    autoComplete="off"
                  />
                </div>
                <button
                  className={styles.loginButton}
                  type="submit"
                  disabled={loggingIn || creating || !persistentSecret}
                >
                  {loggingIn ? "Logging in..." : "Login with Secret"}
                </button>
              </form>
              {showSecretPrompt && (
                <div className={styles.secretPrompt}>
                  <b>Save your Login Key!</b>
                  <div style={{ wordBreak: 'break-all', background: '#181818', padding: 8, borderRadius: 6 }}>
                    <code style={{ userSelect: 'all', flex: 1 }}>{savedPersistentSecret}</code>
                  </div>
                  <button
                    type="button"
                    className={styles.loginButton}
                    style={{ padding: '4px 10px', fontSize: 13, marginTop: 8 }}
                    onClick={handleCopyLoginKey}
                    tabIndex={0}
                  >
                    Copy
                  </button>
                  {copySuccess && (
                    <span style={{ color: '#5ffb7a', fontSize: 13, marginLeft: 4 }}>{copySuccess}</span>
                  )}
                  <div style={{ color: '#ffb700', fontSize: 13, marginBottom: 6, marginTop: 8 }}>
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
      </div>
      <footer className={styles.loginFooter}>
        <span className={styles.buildVersion}>{import.meta.env.VITE_APP_VERSION || 'v0.0.0'}</span>
        <span className={styles.builtBy}>built by Alchemy</span>
        <div className={styles.alchemyAnim} aria-hidden="true">
          <img
            src="/alchemy_1.png"
            alt="Alchemy animation frame 1"
            className={styles.alchemyFrame + ' ' + styles.alchemyFrame1}
            draggable="false"
          />
          <img
            src="/alchemy_2.png"
            alt="Alchemy animation frame 2"
            className={styles.alchemyFrame + ' ' + styles.alchemyFrame2}
            draggable="false"
          />
          <img
            src="/alchemy_3.png"
            alt="Alchemy animation frame 3"
            className={styles.alchemyFrame + ' ' + styles.alchemyFrame3}
            draggable="false"
          />
        </div>
      </footer>
    </div>
  );
}
