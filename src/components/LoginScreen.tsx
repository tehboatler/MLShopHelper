import React, { useState } from "react";
import {
  createAnonymousSessionWithSessionId,
  restoreSessionWithSessionId,
} from "../api/auth";
import { createPersistentAnonUser, loginWithPersistentSecret } from '../api/persistentAnon';

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
      const { user, secret } = await createPersistentAnonUser();
      setUserId(user.$id);
      setSavedPersistentSecret(secret);
      setShowSecretPrompt(true);
      localStorage.setItem('persistentSecret', secret);
      localStorage.setItem('persistentUserId', user.$id);
      onLogin();
    } catch (e: any) {
      setError(e.message || "Failed to create persistent anonymous user.");
    } finally {
      setLoading(false);
    }
  };

  // Handler for login with persistent secret
  const handleLoginWithPersistentSecret = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await loginWithPersistentSecret(persistentSecret);
      if (result) {
        setUserId(result.userId);
        setSavedPersistentSecret(result.secret);
        setShowSecretPrompt(true);
        localStorage.setItem('persistentSecret', result.secret);
        localStorage.setItem('persistentUserId', result.userId);
        onLogin();
      } else {
        setError("Invalid secret or user not found.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to login with secret.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <h2>Login</h2>
      <button onClick={handlePersistentAnonLogin} disabled={loading}>
        {loading ? "Creating..." : "Create Persistent Anonymous Account"}
      </button>
      <hr />
      <div>
        <label>
          Login with Persistent Secret:
          <input
            type="text"
            value={persistentSecret}
            onChange={e => setPersistentSecret(e.target.value)}
            placeholder="Paste your persistent secret here"
            disabled={loading}
          />
        </label>
        <button onClick={handleLoginWithPersistentSecret} disabled={loading || !persistentSecret}>
          {loading ? "Logging in..." : "Login with Secret"}
        </button>
      </div>
      {showSecretPrompt && (
        <div className="login-secret-prompt">
          <h4>Your Persistent Secret</h4>
          <div style={{ marginBottom: 8 }}>
            <b>Secret:</b> <code>{savedPersistentSecret}</code>
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>User ID:</b> <code>{userId}</code>
          </div>
          <div style={{ color: '#ffb700', fontSize: 14 }}>
            <b>Warning:</b> Save these somewhere safe! If you lose it, you cannot recover your data.
          </div>
        </div>
      )}
      {error && <div className="login-error">{error}</div>}
    </div>
  );
}
