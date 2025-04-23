import { useEffect, useState } from 'react';
import { fetchCurrentVersionFromAppwrite, subscribeToVersionChange } from './lib/versionCheck';
// import { BUILD_VERSION } from './constants';
const BUILD_VERSION = import.meta.env.VITE_APP_VERSION;

export default function VersionGatekeeper() {
  const [latestVersion, setLatestVersion] = useState(BUILD_VERSION);
  const [showBlocker, setShowBlocker] = useState(false);

  useEffect(() => {
    fetchCurrentVersionFromAppwrite().then(appwriteVersion => {
      setLatestVersion(appwriteVersion);
      if (appwriteVersion !== BUILD_VERSION) setShowBlocker(true);
    });
    const unsub = subscribeToVersionChange((appwriteVersion) => {
      setLatestVersion(appwriteVersion);
      if (appwriteVersion !== BUILD_VERSION) setShowBlocker(true);
    });
    return () => unsub && unsub();
  }, []);

  if (!showBlocker) return null;

  // Fullscreen blocking overlay
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(20,24,40,0.98)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'inherit',
      fontSize: 18,
      padding: 0,
      margin: 0,
    }}>
      <div style={{
        background: 'rgba(34,40,60,1)',
        borderRadius: 18,
        boxShadow: '0 8px 32px #000a',
        padding: '48px 32px',
        minWidth: 320,
        maxWidth: 400,
        textAlign: 'center',
        border: '1.5px solid #2d8cff',
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 18px 0', color: '#2d8cff' }}>Update Required</h2>
        <p style={{ marginBottom: 32 }}>
          A new version of this app is available.<br />
          Please download the latest version to continue using MLShopHelper.
        </p>
        <a
          href="https://github.com/tehboatler/MLShopHelper/releases"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            background: '#2d8cff',
            color: '#fff',
            fontWeight: 600,
            fontSize: 18,
            padding: '12px 32px',
            borderRadius: 10,
            textDecoration: 'none',
            boxShadow: '0 2px 8px #0003',
            transition: 'background .15s',
          }}
        >
          Download Latest
        </a>
        <div style={{ marginTop: 32, fontSize: 14, color: '#aaa' }}>
          Build version: <b>{BUILD_VERSION}</b><br />
          Required version: <b>{latestVersion}</b>
        </div>
      </div>
    </div>
  );
}
