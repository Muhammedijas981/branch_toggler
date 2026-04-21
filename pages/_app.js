import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
