import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EcommFlow',
  description: 'Gestão de tarefas e rotinas',
  icons: { icon: '/icon.svg' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
