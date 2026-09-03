import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FactoryLink',
  description: 'Offline-first manufacturing coordination platform',
  icons: {
    icon: '/factorylink-logo.png',
    apple: '/factorylink-logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
