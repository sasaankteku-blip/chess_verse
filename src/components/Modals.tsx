import React from 'react';
import {
  X,
  Trophy,
  RotateCcw,
  Home,
  Volume2,
  VolumeX,
  AlertTriangle,
  Handshake,
} from 'lucide-react';
import {
  BoardTheme,
  Difficulty,
  GameMode,
  PieceStyle,
  TIME_CONTROLS,
  TimeControl,
} from '../game/engine';
import { UserPreferences } from '../utils/preferences';
import { BOARD_THEMES } from './Chessboard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (partial: Partial<UserPreferences>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#121A2A] p-6 text-[#F4F2ED] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Game Settings</h2>
            <p className="text-xs text-slate-400">
              Preferences are automatically saved to your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5 max-h-[70vh] overflow-y-auto pr-1 chess-scroll">
          {/* Board Theme Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Board Theme
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((themeKey) => {
                const t = BOARD_THEMES[themeKey];
                const active = preferences.boardTheme === themeKey;
                return (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => onUpdatePreferences({ boardTheme: themeKey })}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-emerald-500 bg-emerald-950/30'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex h-6 w-12 overflow-hidden rounded border border-slate-700">
                      <span
                        className="h-full w-1/2"
                        style={{ backgroundColor: t.lightSquare }}
                      />
                      <span
                        className="h-full w-1/2"
                        style={{ backgroundColor: t.darkSquare }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white whitespace-nowrap">
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Piece Style Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Piece Style
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { id: 'staunton', label: 'Grandmaster Staunton', desc: 'Classic tournament silhouettes' },
                  { id: 'neo', label: 'Neo-Minimalist Royal', desc: 'Crisp geometric vectors' },
                ] as const
              ).map((styleItem) => {
                const active = preferences.pieceStyle === (styleItem.id as PieceStyle);
                return (
                  <button
                    key={styleItem.id}
                    type="button"
                    onClick={() => onUpdatePreferences({ pieceStyle: styleItem.id })}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-emerald-500 bg-emerald-950/30'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-semibold text-white">
                      {styleItem.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {styleItem.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              {
                key: 'soundEnabled' as const,
                label: 'Sound Effects',
                desc: 'Audio feedback for moves & checks',
              },
              {
                key: 'showCoordinates' as const,
                label: 'Board Coordinates',
                desc: 'Show A–H and 1–8 labels',
              },
              {
                key: 'showLegalMoves' as const,
                label: 'Legal Move Indicators',
                desc: 'Highlight target squares & captures',
              },
              {
                key: 'enableAnimations' as const,
                label: 'Piece Animations',
                desc: 'Smooth transitions on move',
              },
            ].map((toggle) => {
              const checked = preferences[toggle.key];
              return (
                <button
                  key={toggle.key}
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() => onUpdatePreferences({ [toggle.key]: !checked })}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-slate-700"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {toggle.label}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {toggle.desc}
                    </div>
                  </div>
                  <div
                    className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      checked ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="h-5 w-5 rounded-full bg-white shadow" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Default Game Mode & Difficulty */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
            <div className="space-y-1.5">
              <label
                htmlFor="default-mode-select"
                className="block text-xs font-semibold text-slate-300"
              >
                Default Mode
              </label>
              <select
                id="default-mode-select"
                value={preferences.defaultGameMode}
                onChange={(e) =>
                  onUpdatePreferences({
                    defaultGameMode: e.target.value as GameMode,
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="ai">Play vs AI</option>
                <option value="two-player">Two Player</option>
                <option value="practice">Practice Mode</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="default-difficulty-select"
                className="block text-xs font-semibold text-slate-300"
              >
                Default Difficulty
              </label>
              <select
                id="default-difficulty-select"
                value={preferences.defaultDifficulty}
                onChange={(e) =>
                  onUpdatePreferences({
                    defaultDifficulty: e.target.value as Difficulty,
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="default-clock-select"
                className="block text-xs font-semibold text-slate-300"
              >
                Default Clock
              </label>
              <select
                id="default-clock-select"
                value={preferences.defaultTimeControl}
                onChange={(e) =>
                  onUpdatePreferences({
                    defaultTimeControl: e.target.value as TimeControl,
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                {(Object.keys(TIME_CONTROLS) as TimeControl[]).map((tc) => (
                  <option key={tc} value={tc}>
                    {TIME_CONTROLS[tc].label} ({TIME_CONTROLS[tc].description})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export interface GameOverDetails {
  title: string;
  subtitle: string;
  winner: 'w' | 'b' | 'draw';
  reason: string;
  totalMoves: number;
  materialAdvantage: string;
}

interface GameOverModalProps {
  details: GameOverDetails | null;
  onPlayAgain: () => void;
  onReturnHome: () => void;
  onDismiss: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  details,
  onPlayAgain,
  onReturnHome,
  onDismiss,
}) => {
  if (!details) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Over Result"
    >
      <div className="w-full max-w-md max-h-[94vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#121A2A] p-4 sm:p-6 text-center text-[#F4F2ED] shadow-2xl chess-scroll">
        <div className="mx-auto mb-2 sm:mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/10 text-amber-400">
          {details.winner === 'draw' ? (
            <Handshake className="h-6 w-6 sm:h-7 sm:w-7" />
          ) : (
            <Trophy className="h-6 w-6 sm:h-7 sm:w-7" />
          )}
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
          {details.title}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-emerald-400 font-medium">
          {details.subtitle}
        </p>
        <p className="mt-1 text-xs text-slate-400">{details.reason}</p>

        {/* 3 Tabular-Nums Stat Tiles */}
        <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-[#0D1320] p-2.5 sm:p-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Outcome
            </div>
            <div className="mt-0.5 text-sm font-bold text-white font-mono-tabular">
              {details.winner === 'w'
                ? '1 – 0'
                : details.winner === 'b'
                ? '0 – 1'
                : '½ – ½'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Total Moves
            </div>
            <div className="mt-0.5 text-sm font-bold text-white font-mono-tabular">
              {details.totalMoves}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Material
            </div>
            <div className="mt-0.5 text-sm font-bold text-amber-300 font-mono-tabular">
              {details.materialAdvantage}
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 flex flex-row gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 sm:px-4 sm:py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Play Again</span>
          </button>
          <button
            type="button"
            onClick={onReturnHome}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 sm:px-4 sm:py-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="h-4 w-4" />
            <span>Main Menu</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-2.5 sm:mt-3 text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4 cursor-pointer"
        >
          Inspect Final Board
        </button>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'emerald';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'emerald',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm max-h-[94vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#121A2A] p-5 sm:p-6 text-[#F4F2ED] shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 sm:mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-bold text-white cursor-pointer ${
              confirmVariant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
