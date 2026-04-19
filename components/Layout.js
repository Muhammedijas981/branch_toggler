import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';
import styles from '../styles/Layout.module.css';

const NAV = [
  { href: '/',         label: 'Dashboard', icon: '⚡' },
  { href: '/history',  label: 'History',   icon: '📋' },
  { href: '/schedule', label: 'Schedule',  icon: '⏰' },
  { href: '/settings', label: 'Settings',  icon: '⚙️' },
];

export default function Layout({ children }) {
  const { data: session } = useSession();
  const router = useRouter();

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className={styles.wrapper}>
      <nav className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>🚀</span>
          <span>Branch Toggler</span>
        </Link>

        <div className={styles.navLinks}>
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.navLink} ${router.pathname === href ? styles.active : ''}`}
            >
              {icon} {label}
            </Link>
          ))}
        </div>

        <div className={styles.navRight}>
          <div className={styles.userInfo}>
            {session?.user?.image ? (
              <img src={session.user.image} alt="" className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>{initials}</div>
            )}
            <span className={styles.userName}>{session?.user?.name}</span>
          </div>
          <button
            className={styles.signOutBtn}
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
