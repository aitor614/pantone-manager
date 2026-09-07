'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, getDisplayUsername } from '@/lib/auth';

export default function Navbar() {
  const { profile, isAdmin, signOut } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    {
      href: '/',
      label: 'Inicio',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      href: '/nuevo',
      label: 'Nuevo',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    }
  ];

  if (isAdmin) {
    navLinks.push({
      href: '/admin',
      label: 'Admin',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-slate-900/80 backdrop-blur-xl border-t border-slate-700/50 z-50 md:bottom-auto md:top-0 md:border-t-0 md:border-b">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-around items-center h-16 md:justify-between">
          <div className="hidden md:flex items-center space-x-2">
            <span className="text-xl font-bold text-slate-100">Pantone<span className="text-violet-500">Manager</span></span>
          </div>
          
          <div className="flex justify-around flex-1 md:flex-none md:space-x-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center justify-center w-full md:w-auto space-y-1 transition-all duration-200 ${
                    isActive ? 'text-violet-500' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {link.icon}
                  <span className="text-xs font-medium">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-3">
            {profile && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/70 border border-slate-700/50 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-medium">{profile.display_name || getDisplayUsername(profile.email)}</span>
              </div>
            )}
            <button
              onClick={signOut}
              className="flex flex-col items-center justify-center text-slate-400 hover:text-slate-100 transition-all duration-200 md:flex-row md:space-x-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs font-medium md:text-sm">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
