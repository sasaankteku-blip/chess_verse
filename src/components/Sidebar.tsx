import React, { useState } from 'react';
import {
  Home,
  Play,
  Bot,
  Users,
  Puzzle,
  GraduationCap,
  Microscope,
  Settings,
  Volume2,
  VolumeX,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';

export type NavDestination =
  | 'home'
  | 'play'
  | 'play-computer'
  | 'two-player'
  | 'puzzles'
  | 'learn'
  | 'analysis';

interface SidebarProps {
  activeNav: NavDestination;
  onNavigate: (dest: NavDestination) => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

interface NavItemConfig {
  id: NavDestination;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'play', label: 'Play', icon: Play },
  { id: 'play-computer', label: 'Play Computer', icon: Bot },
  { id: 'two-player', label: 'Two Player', icon: Users },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle, badge: 'Soon' },
  { id: 'learn', label: 'Learn', icon: GraduationCap, badge: 'Practice' },
  { id: 'analysis', label: 'Analysis', icon: Microscope },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavigate,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
  soundEnabled,
  onToggleSound,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileNav = (dest: NavDestination) => {
    setMobileMenuOpen(false);
    onNavigate(dest);
  };

  return (
    <>
      {/* Mobile Top Header Bar */}
      <div className="flex lg:hidden items-center justify-between border-b border-slate-800/90 bg-[#0D131F] px-4 py-2.5">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left"
        >
          <svg
            viewBox="0 0 44 44"
            className="h-8 w-8 shrink-0"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="40"
              height="40"
              rx="10"
              fill="#0F3D30"
              stroke="#D4AF37"
              strokeWidth="2"
            />
            <path d="M 14,33 L 30,33 L 28,28 L 16,28 Z" fill="#D4AF37" />
            <path
              d="M 16,28 L 17,18 L 13,18 L 16,11 L 22,9 L 28,12 C 30,16 30,22 28,28 Z"
              fill="#F4F2ED"
              stroke="#0B101B"
              strokeWidth="1.2"
            />
            <circle cx="20.5" cy="14" r="1.4" fill="#10B981" />
          </svg>
          <span className="text-base font-bold tracking-tight text-white">
            ChessVerse
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#141D2E] text-slate-200"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#141D2E] text-amber-400"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            data-testid="mobile-menu-btn"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#141D2E] text-slate-200"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden border-b border-slate-800 bg-[#101726] px-4 py-3 space-y-1.5"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMobileNav(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-medium ${
                      isActive ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenSettings();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            <Settings className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* Desktop Persistent Collapsible Left Sidebar */}
      <aside
        aria-label="Main Navigation Sidebar"
        data-testid="desktop-sidebar"
        className={`hidden lg:flex flex-col justify-between shrink-0 border-r border-slate-800/90 bg-[#0D131F] select-none transition-all duration-150 ${
          collapsed ? 'w-[72px]' : 'w-[228px]'
        }`}
      >
        {/* Top Section: Brand Identity + Primary Navigation Links */}
        <div className="p-3 space-y-4">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-1.5 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
              title="ChessVerse Home"
            >
              <svg
                viewBox="0 0 44 44"
                className="h-9 w-9 shrink-0 transition-transform group-hover:scale-105"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="2"
                  width="40"
                  height="40"
                  rx="10"
                  fill="#0F3D30"
                  stroke="#D4AF37"
                  strokeWidth="2"
                />
                <path d="M 14,33 L 30,33 L 28,28 L 16,28 Z" fill="#D4AF37" />
                <path
                  d="M 16,28 L 17,18 L 13,18 L 16,11 L 22,9 L 28,12 C 30,16 30,22 28,28 Z"
                  fill="#F4F2ED"
                  stroke="#0B101B"
                  strokeWidth="1.2"
                />
                <circle cx="20.5" cy="14" r="1.4" fill="#10B981" />
              </svg>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                    ChessVerse
                  </div>
                  <div className="text-[10px] font-medium text-emerald-400/90 whitespace-nowrap">
                    Master Your Game
                  </div>
                </div>
              )}
            </button>
          </div>

          {/* Primary Navigation Items */}
          <nav aria-label="Primary Navigation" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-${item.id}`}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex w-full items-center ${
                    collapsed ? 'justify-center px-2' : 'justify-between px-3'
                  } rounded-xl py-2.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                      : 'text-slate-300 hover:bg-[#151F32] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 group-hover:text-emerald-400'
                      }`}
                    />
                    {!collapsed && (
                      <span className="whitespace-nowrap truncate">
                        {item.label}
                      </span>
                    )}
                  </span>

                  {!collapsed && item.badge && (
                    <span
                      className={`text-[10px] font-medium whitespace-nowrap ${
                        isActive ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Sound Toggle, Settings & Sidebar Collapse */}
        <div className="border-t border-slate-800/80 p-3 space-y-1">
          <button
            type="button"
            data-testid="nav-settings"
            onClick={onOpenSettings}
            title={collapsed ? 'Settings' : undefined}
            className={`group flex w-full items-center ${
              collapsed ? 'justify-center px-2' : ' gap-3 px-3'
            } rounded-xl py-2.5 text-xs font-semibold text-slate-300 hover:bg-[#151F32] hover:text-white transition-colors`}
          >
            <Settings className="h-4 w-4 shrink-0 text-amber-400" />
            {!collapsed && <span className="whitespace-nowrap">Settings</span>}
          </button>

          <button
            type="button"
            data-testid="sidebar-sound-btn"
            onClick={onToggleSound}
            title={collapsed ? (soundEnabled ? 'Sound On' : 'Sound Off') : undefined}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
            className={`group flex w-full items-center ${
              collapsed ? 'justify-center px-2' : 'gap-3 px-3'
            } rounded-xl py-2.5 text-xs font-semibold text-slate-300 hover:bg-[#151F32] hover:text-white transition-colors`}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <VolumeX className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            {!collapsed && (
              <span className="whitespace-nowrap">
                {soundEnabled ? 'Sound: On' : 'Sound: Off'}
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`group flex w-full items-center ${
              collapsed ? 'justify-center px-2' : 'gap-3 px-3'
            } rounded-xl py-2 text-xs font-medium text-slate-400 hover:bg-[#151F32] hover:text-slate-200 transition-colors`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Collapse Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
