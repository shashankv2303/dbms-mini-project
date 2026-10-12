import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'SoundTrail — discover music by mood',
  description: 'Mood-based music discovery and playlist curation on PostgreSQL + pgvector.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />
          <main className="container">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
