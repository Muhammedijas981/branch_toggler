import Head from 'next/head';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import styles from '../styles/Login.module.css';

const FEATURES = [
  { icon: '🔒', text: 'Secure OAuth — no static tokens stored' },
  { icon: '⚡', text: 'One-click production branch switching' },
  { icon: '⏰', text: 'Schedule future branch switches' },
  { icon: '🔔', text: 'Slack & Discord notifications' },
  { icon: '📋', text: 'Full audit trail of every change' },
];

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const error = router.query.error;

  useEffect(() => {
    if (session) router.replace('/');
  }, [session, router]);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn('vercel', { callbackUrl: '/' });
  };

  if (status === 'loading' || session) return null;

  return (
    <div className={styles.page}>
      <Head>
        <title>Sign in — Branch Toggler</title>
        <meta name="description" content="Sign in to Branch Toggler with your Vercel account." />
      </Head>

      <div className={styles.card}>
        <span className={styles.logo}>🚀</span>
        <h1 className={styles.title}>Branch Toggler</h1>
        <p className={styles.subtitle}>
          Your Vercel production deployment<br />control center.
        </p>

        <button
          className={styles.signInBtn}
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.2)' }} />
              Connecting…
            </>
          ) : (
            <>
              <span className={styles.vercelLogo}>▲</span>
              Continue with Vercel
            </>
          )}
        </button>

        {error && (
          <div className={styles.error}>
            {error === 'OAuthSignin' || error === 'OAuthCallback'
              ? 'Failed to connect with Vercel. Please try again.'
              : 'An error occurred. Please try again.'}
          </div>
        )}

        <div className={styles.divider}>included features</div>

        <div className={styles.features}>
          {FEATURES.map(({ icon, text }) => (
            <div key={text} className={styles.feature}>
              <span className={styles.featureIcon}>{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
