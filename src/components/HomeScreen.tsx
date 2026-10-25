import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import {
  Bot,
  Users,
  GraduationCap,
  Settings,
  Volume2,
  VolumeX,
  Play,
  Clock,
  Shield,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import {
  Difficulty,
  GameMode,
  PieceStyle,
  PlayerColorChoice,
  TIME_CONTROLS,
  TimeControl,
} from '../game/engine';
import { ChessPieceSVG } from './ChessPieces';

interface HomeScreenProps {
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
  selectedColor: PlayerColorChoice;
  onSelectColor: (color: PlayerColorChoice) => void;
  selectedTimeControl: TimeControl;
  onSelectTimeControl: (tc: TimeControl) => void;
  onStartGame: (overrideMode?: GameMode) => void;
  onOpenSettings: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  pieceStyle: PieceStyle;
}

const SHOWCASE_MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  selectedMode,
  onSelectMode,
  selectedDifficulty,
  onSelectDifficulty,
  selectedColor,
  onSelectColor,
  selectedTimeControl,
  onSelectTimeControl,
  onStartGame,
  onOpenSettings,
  soundEnabled,
  onToggleSound,
  pieceStyle,
}) => {
  const [previewStep, setPreviewStep] = useState(4);
  const [hoveredPreviewSq, setHoveredPreviewSq] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewStep((prev) => (prev + 1) % (SHOWCASE_MOVES.length + 1));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const previewChess = new Chess();
  let lastPreviewMove: { from: string; to: string; san: string } | null = null;
  for (let i = 0; i < previewStep; i++) {
    const m = previewChess.move(SHOWCASE_MOVES[i]);
    if (m) lastPreviewMove = { from: m.from, to: m.to, san: m.san };
  }
  const previewBoard = previewChess.board();

  return (
    <main className="min-h-screen w-full bg-[#0B101B] text-[#F4F2ED] flex flex-col justify-between px-4 py-5 sm:px-8 sm:py-7 lg:px-12">
      {/* Top Bar — Brand Emblem + Utility Controls */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Custom Inline SVG Emblem */}
          <svg
            viewBox="0 0 44 44"
            className="h-10 w-10 shrink-0"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="40"
              height="40"
              rx="10"
              fill="#111C2D"
              stroke="#10B981"
              strokeWidth="1.75"
            />
            <path
              d="M 14,33 L 30,33 L 28,28 L 16,28 Z"
              fill="#D4AF37"
            />
            <path
              d="M 16,28 L 17,18 L 13,18 L 16,11 L 22,9 L 28,12 C 30,16 30,22 28,28 Z"
              fill="#F4F2ED"
              stroke="#0B101B"
              strokeWidth="1.2"
            />
            <circle cx="20.5" cy="14" r="1.4" fill="#10B981" />
          </svg>
          <div>
            <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">
              ChessVerse
            </span>
            <span className="hidden sm:inline-block ml-3 text-xs text-emerald-400/90">
              Master Your Game
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-[#131C2E] text-slate-300 hover:border-emerald-500/50 hover:text-white transition-colors"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#131C2E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap"
          >
            <Settings className="h-4 w-4 text-amber-400" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="mx-auto my-auto w-full max-w-7xl py-6 lg:py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Hero, Game Modes, Difficulty & Match Configuration */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium tracking-wider text-emerald-400">
                Grandmaster Chess Suite · Classical Rules · Tactical Engine
              </p>
              <h1
                className="font-display text-4xl sm:text-5xl lg:text-[54px] font-bold leading-[1.08] tracking-tight text-white"
                style={{ textWrap: 'balance' }}
              >
                Every Move Tells a Story.
              </h1>
              <p className="max-w-xl text-sm sm:text-base text-slate-300 leading-relaxed">
                Challenge a multi-depth tactical AI engine, play over-the-board with a friend on one device, or sharpen your calculation in the interactive practice lab.
              </p>
            </div>

            {/* 1. Three Game Mode Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-300">
                  1. Select Game Mode
                </h2>
                <span className="text-xs text-slate-400">
                  {selectedMode === 'ai'
                    ? 'Single-Player vs Computer'
                    : selectedMode === 'two-player'
                    ? 'Pass & Play on Same Device'
                    : 'Free Play with Evaluated Hints'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(
                  [
                    {
                      id: 'ai',
                      title: 'Play vs AI',
                      subtitle: '3 distinct engine levels',
                      icon: Bot,
                    },
                    {
                      id: 'two-player',
                      title: 'Two Player',
                      subtitle: 'Local shared board',
                      icon: Users,
                    },
                    {
                      id: 'practice',
                      title: 'Practice Mode',
                      subtitle: 'Hints & move feedback',
                      icon: GraduationCap,
                    },
                  ] as const
                ).map((modeCard) => {
                  const Icon = modeCard.icon;
                  const isActive = selectedMode === modeCard.id;
                  return (
                    <button
                      key={modeCard.id}
                      type="button"
                      onClick={() => onSelectMode(modeCard.id)}
                      data-testid={`mode-card-${modeCard.id}`}
                      className={`group flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all duration-150 ${
                        isActive
                          ? 'border-emerald-500 bg-[#142532] shadow-lg shadow-emerald-950/40'
                          : 'border-slate-800/90 bg-[#121A2A] hover:border-slate-700 hover:bg-[#162033]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between mb-2.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800/80 text-slate-400 group-hover:text-slate-200'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isActive
                              ? 'text-emerald-400 translate-x-0.5'
                              : 'text-slate-600 group-hover:text-slate-400'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white whitespace-nowrap">
                          {modeCard.title}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {modeCard.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Difficulty & Color Selection (Highlighted for AI Mode, always accessible) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-amber-400" />
                    AI Difficulty
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {selectedDifficulty === 'easy'
                      ? 'Casual · Depth 1 + Variety'
                      : selectedDifficulty === 'medium'
                      ? 'Balanced · Tactical Search'
                      : 'Master · Opening Book + Deep Search'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800/90 bg-[#121A2A] p-1.5">
                  {(
                    [
                      { id: 'easy', label: 'Easy', desc: 'Beginner' },
                      { id: 'medium', label: 'Medium', desc: 'Club' },
                      { id: 'hard', label: 'Hard', desc: 'Master' },
                    ] as const
                  ).map((diff) => {
                    const active = selectedDifficulty === diff.id;
                    return (
                      <button
                        key={diff.id}
                        type="button"
                        data-testid={`difficulty-${diff.id}`}
                        onClick={() => onSelectDifficulty(diff.id)}
                        className={`flex flex-col items-center justify-center rounded-lg py-2 px-2 transition-colors ${
                          active
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-semibold whitespace-nowrap">
                          {diff.label}
                        </span>
                        <span
                          className={`text-[10px] ${
                            active ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          {diff.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Player Side Choice */}
              <div className="sm:col-span-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Play As
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {selectedColor === 'w'
                      ? 'White (Moves 1st)'
                      : selectedColor === 'b'
                      ? 'Black (Moves 2nd)'
                      : 'Random Assignment'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800/90 bg-[#121A2A] p-1.5">
                  {(
                    [
                      { id: 'w', label: 'White' },
                      { id: 'random', label: 'Random' },
                      { id: 'b', label: 'Black' },
                    ] as const
                  ).map((side) => {
                    const active = selectedColor === side.id;
                    return (
                      <button
                        key={side.id}
                        type="button"
                        data-testid={`color-${side.id}`}
                        onClick={() => onSelectColor(side.id)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 px-2 transition-colors ${
                          active
                            ? 'bg-amber-500/20 border border-amber-400/60 text-amber-200'
                            : 'border border-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        <div className="flex h-4 items-center justify-center">
                          {side.id === 'w' && (
                            <div className="h-4 w-4">
                              <ChessPieceSVG type="k" color="w" style={pieceStyle} />
                            </div>
                          )}
                          {side.id === 'b' && (
                            <div className="h-4 w-4 rounded bg-[#EAE6DF]/90 p-0.5">
                              <ChessPieceSVG type="k" color="b" style={pieceStyle} />
                            </div>
                          )}
                          {side.id === 'random' && (
                            <div className="flex items-center -space-x-1">
                              <div className="h-3.5 w-3.5">
                                <ChessPieceSVG type="k" color="w" style={pieceStyle} />
                              </div>
                              <div className="h-3.5 w-3.5 rounded bg-[#EAE6DF]/90 p-0.5">
                                <ChessPieceSVG type="k" color="b" style={pieceStyle} />
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-semibold whitespace-nowrap leading-none">
                          {side.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Time Control Selection & Primary CTA */}
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    Chess Clock Preset
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono-tabular">
                    {TIME_CONTROLS[selectedTimeControl].label} · {TIME_CONTROLS[selectedTimeControl].description}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(TIME_CONTROLS) as TimeControl[]).map((tcKey) => {
                    const tc = TIME_CONTROLS[tcKey];
                    const active = selectedTimeControl === tc.id;
                    return (
                      <button
                        key={tc.id}
                        type="button"
                        data-testid={`clock-${tc.id}`}
                        onClick={() => onSelectTimeControl(tc.id)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                          active
                            ? 'border-emerald-500/80 bg-emerald-950/40 text-white'
                            : 'border-slate-800 bg-[#121A2A] text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-semibold whitespace-nowrap">
                          {tc.label}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-emerald-400">
                          {tc.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prominent Play Chess Button */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  data-start="true"
                  data-testid="play-chess-btn"
                  onClick={() => onStartGame()}
                  className="flex items-center justify-center gap-3 rounded-xl bg-emerald-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-950/60 hover:bg-emerald-500 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>Play Chess</span>
                </button>

                <div className="text-xs text-slate-400">
                  <span>Ready: </span>
                  <strong className="text-slate-200">
                    {selectedMode === 'ai'
                      ? `vs AI (${selectedDifficulty.toUpperCase()})`
                      : selectedMode === 'two-player'
                      ? 'Two Player Local'
                      : 'Practice Lab'}
                  </strong>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono-tabular text-amber-300/90">
                    {TIME_CONTROLS[selectedTimeControl].label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Animated Chessboard Preview */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[420px] rounded-2xl border border-slate-800/90 bg-[#121A2A] p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Live Opening Showcase · Italian Game
                  </span>
                </div>
                <span className="text-xs font-mono-tabular text-emerald-400">
                  {lastPreviewMove
                    ? `Move ${Math.ceil(previewStep / 2)}: ${lastPreviewMove.san}`
                    : 'Starting Position'}
                </span>
              </div>

              {/* Mini 8x8 Interactive Preview Board */}
              <div
                className="grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border-2 border-[#1E2E2A]"
                aria-label="Animated chessboard preview"
              >
                {previewBoard.map((row, rIdx) =>
                  row.map((cell, cIdx) => {
                    const file = 'abcdefgh'[cIdx];
                    const rank = 8 - rIdx;
                    const sq = `${file}${rank}`;
                    const isLight = (rIdx + cIdx) % 2 === 0;
                    const isHighlighted =
                      lastPreviewMove?.from === sq || lastPreviewMove?.to === sq;
                    const isHovered = hoveredPreviewSq === sq;

                    let bg = isLight ? '#EAE6DF' : '#2E6F54';
                    if (isHighlighted) {
                      bg = isLight ? '#DCE5B5' : '#478C63';
                    }

                    return (
                      <div
                        key={sq}
                        onMouseEnter={() => setHoveredPreviewSq(sq)}
                        onMouseLeave={() => setHoveredPreviewSq(null)}
                        style={{ backgroundColor: bg }}
                        className={`relative flex items-center justify-center p-1 transition-transform ${
                          isHovered ? 'ring-2 ring-inset ring-amber-400' : ''
                        }`}
                      >
                        {cell && (
                          <div className="h-[85%] w-[85%]">
                            <ChessPieceSVG
                              type={cell.type}
                              color={cell.color}
                              style={pieceStyle}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Preview Footer Controls */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {hoveredPreviewSq
                    ? `Inspecting square ${hoveredPreviewSq.toUpperCase()}`
                    : 'Hover squares or step through moves'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewStep((prev) =>
                        prev > 0 ? prev - 1 : SHOWCASE_MOVES.length
                      )
                    }
                    className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-500/60"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewStep((prev) => (prev + 1) % (SHOWCASE_MOVES.length + 1))
                    }
                    className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-500/60"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Clean Control Hint */}
      <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-slate-800/70 pt-4 text-xs text-slate-400">
        <span>
          Click or Drag Pieces to Move · Enter Start Match · F Flip Board · Z Undo · H Hint
        </span>
        <span>
          Full FIDE Rules: Castling · En Passant · Promotion · 3-Fold Repetition · 50-Move Rule
        </span>
      </footer>
    </main>
  );
};
