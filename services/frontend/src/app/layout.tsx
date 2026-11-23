import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: 'WorkSphere - Multi-Tenant Project Management & Workflow Automation',
  description: 'Enterprise-grade multi-tenant project planning, real-time collaboration, and analytics platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
