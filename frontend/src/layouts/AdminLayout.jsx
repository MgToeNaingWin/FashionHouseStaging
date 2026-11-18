
import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector } from '../hooks/useAppSelector';
import { selectUser } from '../features/auth/authSlice.jsx';
import { getAdminSocket } from '../services/socket.js';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Mail,
  Users,
  Settings,
  Shirt,
  Store,
  Sun,
  Moon,
  HomeIcon,
  ShoppingBag,
  ShoppingCartPlus,
  Menu,
  X,
} from 'lucide-react';

const AdminLayout = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const user = useAppSelector(selectUser);

  const [isHovered, setIsHovered] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Single shared socket connection for every admin page. AdminRoute above
  // already guarantees this layout only renders for authenticated admins, so
  // the handshake cookie identifies an admin. socket.io-client re-connects
  // automatically after network drops; pages handle missed events on reconnect.
  useEffect(() => {
    const socket = getAdminSocket();
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  const isActive = (path) => location.pathname.startsWith(path);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const currentLang = i18n.language?.startsWith('mm') ? 'mm' : 'en';

  const iconProps = {
    size: 20,
    strokeWidth: 1.7,
  };

  const menuGroups = [
    {
      title: t('admin.project') || 'PROJECT',
      items: [
        {
          path: '/admin/dashboard',
          label: t('admin.dashboard'),
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: t('admin.database') || 'DATABASE',
      items: [
        {
          path: '/admin/products',
          label: t('admin.products.title'),
          icon: Package,
        },
        {
          path: '/admin/orders',
          label: t('admin.orders.title'),
          icon: ShoppingCart,
        },
        {
          path: '/admin/messages',
          label: t('admin.messages.title'),
          icon: Mail,
        },
        {
          path: '/shop',
          label: t('admin.shop.title'),
          icon: ShoppingCartPlus,
        },
      ],
    },
    {
      title: t('admin.services') || 'SERVICES',
      items: [
        {
          path: '/admin/users',
          label: t('admin.users.title'),
          icon: Users,
        },
        {
          path: '/admin/settings',
          label: t('admin.settings.title'),
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans transition-colors duration-300">

      {/* SIDEBAR */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col fixed h-full z-20 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${sidebarOpen || isHovered ? 'w-64' : 'w-[70px]'}`}
      >
        {/* Top Logo Area */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 overflow-hidden whitespace-nowrap">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="mr-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#e8363c] dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
          <div className="w-8 h-8 min-w-[32px] bg-[#e8363c] rounded-full flex items-center justify-center text-white">
            <Shirt size={18} strokeWidth={1.8} />
          </div>

          <span
            className={`ml-3 font-bold text-lg text-gray-800 dark:text-white transition-opacity duration-300 ${
              sidebarOpen || isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {t('admin.panel') || 'Admin Panel'}
          </span>
        </div>

        {/* Menu Area */}
        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
          {menuGroups.map((group, idx) => (
            <div key={idx} className="mb-6">
              <div
                className={`px-5 mb-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider transition-opacity duration-300 ${
                  sidebarOpen || isHovered ? 'opacity-100' : 'opacity-0'
                } ${!sidebarOpen && !isHovered ? 'h-0 overflow-hidden' : ''}`}
              >
                {group.title}
              </div>

              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={!isHovered ? item.label : undefined}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center px-4 py-3 mx-2 rounded-lg transition-colors ${
                        isActive(item.path)
                          ? 'bg-[#FFF0EC] text-[#e8363c] dark:bg-red-900/20'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="min-w-[32px] flex items-center">
                        <Icon {...iconProps} />
                      </span>

                      <span
                        className={`ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-300 ${
                          sidebarOpen || isHovered ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Bottom Back to Store */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <Link
            to="/"
            title={!isHovered ? (t('admin.backToStore') || 'Back to Store') : undefined}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center text-gray-500 hover:text-[#e8363c] dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <span className="min-w-[32px] ml-1 flex items-center">
              <Store {...iconProps} />
            </span>

            <span
              className={`ml-2 text-sm whitespace-nowrap transition-opacity duration-300 ${
                sidebarOpen || isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {t('admin.backToStore') || 'Back to Store'}
            </span>
          </Link>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-ink/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* MAIN CONTENT AREA — min-w-0 stops wide tables from stretching the
          whole admin column past the viewport; each table scrolls itself. */}
      <div
        className={`flex-1 min-w-0 w-full flex flex-col h-dvh transition-all duration-300 ease-in-out ${isHovered ? 'md:ml-64' : 'md:ml-[70px]'}`}
      >
        {/* Topbar */}
        <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 h-16 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 shrink-0">

          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
          </button>

          {/* Breadcrumb / Title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* <span className="text-[#e8363c] text-xs font-bold tracking-wider uppercase">
              {t('admin.project') || 'PROJECT'}
            </span> */}
            <span className="min-w-0 truncate text-gray-500 dark:text-gray-400 text-sm">
              FashionHouse
            </span>
          </div>

          {/* Language, Theme & Actions */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-5 text-gray-500 dark:text-gray-400">

            {/* Language Switcher */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden mr-0 sm:mr-2">
              <button
                onClick={() => changeLanguage('en')}
                className={`px-2 py-1 text-xs font-bold transition-colors ${
                  currentLang === 'en'
                    ? 'bg-[#e8363c] text-white'
                    : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                EN
              </button>

              <button
                onClick={() => changeLanguage('mm')}
                className={`px-2 py-1 text-xs font-bold transition-colors ${
                  currentLang === 'mm'
                    ? 'bg-[#e8363c] text-white'
                    : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                MM
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
              className="hover:text-[#e8363c] transition-colors"
            >
              {isDark ? (
                <Sun size={20} strokeWidth={1.7} />
              ) : (
                <Moon size={20} strokeWidth={1.7} />
              )}
            </button>

            <Link
              to="/admin/settings"
              aria-label={t('admin.settings.title')}
              title={t('admin.settings.title')}
              className="hover:text-[#e8363c] transition-colors"
            >
              <Settings size={20} strokeWidth={1.7} />
            </Link>

            {/* Profile */}
            <Link to="/account" className="flex items-center gap-3 border-l border-gray-200 pl-2 sm:pl-4 dark:border-gray-800 group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-[#e8363c] transition-colors">
                  {user?.username || t('admin.adminUser')}
                </p>
                <p className="text-[10px] text-gray-500 uppercase">
                  {user?.role === 'admin' ? t('admin.manager') : user?.role}
                </p>
              </div>

              <span className="w-9 h-9 rounded-full bg-[#e8363c] text-white flex items-center justify-center font-display font-bold border border-gray-200 dark:border-gray-700">
                {(user?.username || 'A').charAt(0).toUpperCase()}
              </span>
            </Link>
          </div>
        </header>

        {/* Content — the only scroll surface of the admin shell. Wide tables
            scroll inside their own wrapper, never the page itself. */}
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
