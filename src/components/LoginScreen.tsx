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
  const [invitePromptOpen, setInvitePromptOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");

  // Handler for persistent anonymous login
  const handlePersistentAnonLogin = async () => {
    setError("");
    setInviteError("");
    setInvitePromptOpen(true);
  };

  // Handler for actually creating the account after invite code is entered
  const handleCreateWithInvite = async () => {
    if (!inviteCode.trim()) {
      setInviteError("Invite code is required.");
      return;
    }
    setInviteError("");
    setCreating(true);
    try {
      // Validate and redeem invite before creating the user
      const redeemInvite = (await import('../api/invites')).redeemInvite;
      // Throws if invalid or already used
      await redeemInvite(inviteCode.trim(), 'pending'); // Use 'pending', will update after user creation
      // Create the user
      const { user, secret, email } = await createPersistentAnonUser(inviteCode.trim());
      setUserId(user.$id);
      const loginKey = `${email}:${secret}`;
      setSavedPersistentSecret(loginKey);
      setShowSecretPrompt(true);
      localStorage.setItem('persistentSecret', loginKey);
      localStorage.setItem('persistentUserId', user.$id);
      localStorage.setItem('persistentEmail', email);
      setInvitePromptOpen(false);
      // Mark invite as redeemed with actual userId
      await redeemInvite(inviteCode.trim(), user.$id);
      onLogin();
    } catch (e: any) {
      setInviteError(e.message || "Invalid invite code.");
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
      {invitePromptOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(30,34,44,0.80)',
            backdropFilter: 'blur(8px)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onClick={() => { setInvitePromptOpen(false); setInviteCode(""); }}
        >
          <div
            style={{
              minWidth: 320,
              maxWidth: 400,
              width: '90vw',
              background: 'rgba(36,40,54,0.98)',
              borderRadius: 20,
              boxShadow: '0 12px 48px 0 rgba(20,20,30,0.60)',
              border: '1.5px solid rgba(220,225,255,0.13)',
              padding: '36px 32px 28px 32px',
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              onClick={() => { setInvitePromptOpen(false); setInviteCode(""); }}
              style={{
                position: 'absolute', top: 18, right: 18,
                background: 'none', border: 'none', color: '#aaa', fontSize: 22, cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.color = '#fff')}
              onMouseOut={e => (e.currentTarget.style.color = '#aaa')}
            >
              ×
            </button>
            <h2 style={{ marginBottom: 8, fontWeight: 700, fontSize: 28, letterSpacing: '-1px', color: '#fff' }}>
              Enter Invite Code
            </h2>
            <div style={{ color: '#aab3c5', marginBottom: 24, fontSize: 15, textAlign: 'center' }}>
              Enter a valid invite code to create your account.
            </div>
            <form
              onSubmit={e => { e.preventDefault(); handleCreateWithInvite(); }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                placeholder="Invite code"
                autoFocus
                maxLength={32}
                style={{
                  padding: '13px 16px',
                  borderRadius: 12,
                  border: inviteError ? '1.5px solid #ff4d4f' : '1.5px solid #38405a',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 17,
                  outline: 'none',
                  transition: 'border 0.2s',
                  marginBottom: 4,
                }}
                onFocus={e => (e.currentTarget.style.border = '1.5px solid #2d8cff')}
                onBlur={e => (e.currentTarget.style.border = inviteError ? '1.5px solid #ff4d4f' : '1.5px solid #38405a')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (inviteCode.trim()) {
                      handleCreateWithInvite();
                    }
                  }
                }}
                disabled={creating}
              />
              {inviteError && <div style={{ color: '#ff4d4f', marginBottom: 4, fontSize: 14 }}>{inviteError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: 'linear-gradient(90deg, #2d8cff 0%, #5b7fff 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 17,
                    padding: '12px 0',
                    cursor: 'pointer',
                    boxShadow: '0 2px 12px 0 rgba(45,140,255,0.08)',
                    transition: 'background 0.15s',
                  }}
                  disabled={!inviteCode.trim() || creating}
                >
                  {creating ? 'Creating...' : 'Continue'}
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: 'rgba(120,130,160,0.16)',
                    color: '#c1c7d6',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 500,
                    fontSize: 17,
                    padding: '12px 0',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => { setInvitePromptOpen(false); setInviteCode(""); }}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
