import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import {
  Bot,
  Users,
  GraduationCap,
  Play,
  Clock,
  Shield,
  Sparkles,
  ChevronRight,
  Microscope,
  Puzzle,
  History,
  ArrowUpRight,
} from 'lucide-react';
import {
  Difficulty,
  GameMode,
  PieceStyle,
  PlayerColorChoice,
  TIME_CONTROLS,
  TimeControl,
} from '../game/engine';
import { RecentGameRecord } from '../utils/preferences';
import { ChessPieceSVG } from './ChessPieces';
import { NavDestination } from './Sidebar';

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
  onNavigateSection: (dest: NavDestination) => void;
  recentGames: RecentGameRecord[];
  onRequestClearHistory?: () => void;
  pieceStyle: PieceStyle;
}

const SHOWCASE_MOVES = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bc4',
  'Bc5',
  'c3',
  'Nf6',
  'd4',
  'exd4',
  'cxd4',
  'Bb4+',
];

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
  onNavigateSection,
  recentGames,
  onRequestClearHistory,
  pieceStyle,
}) => {
  const [previewStep, setPreviewStep] = useState(4);
  const [hoveredPreviewSq, setHoveredPreviewSq] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewStep((prev) => (prev + 1) % (SHOWCASE_MOVES.length + 1));
    }, 2400);
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
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Personalized Welcome & Quick Play Strip */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#111927] p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-emerald-400">
              ChessVerse Arena · FIDE Standard Rules · Multi-Depth Engine
            </div>
            <h1
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white"
              style={{ textWrap: 'balance' }}
            >
              Every Move Tells a Story.
            </h1>
            <p className="max-w-xl text-xs sm:text-sm text-slate-300">
              Jump directly into a rated-style computer match, challenge a friend on one device, or analyze positions with live tactical hints.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              data-start="true"
              data-testid="play-chess-btn"
              onClick={() => onStartGame()}
              className="flex items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/60 hover:bg-emerald-500 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Play Chess</span>
            </button>

            <button
              type="button"
              data-testid="quick-play-computer-btn"
              onClick={() => onStartGame('ai')}
              className="flex items-center gap-2 rounded-xl border border-slate-700/90 bg-[#172235] px-4 py-3.5 text-xs font-semibold text-slate-100 hover:border-emerald-500/60 hover:bg-[#1B283E] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Bot className="h-4 w-4 text-emerald-400" />
              <span>Play Computer</span>
            </button>

            <button
              type="button"
              data-testid="quick-two-player-btn"
              onClick={() => onStartGame('two-player')}
              className="flex items-center gap-2 rounded-xl border border-slate-700/90 bg-[#172235] px-4 py-3.5 text-xs font-semibold text-slate-100 hover:border-amber-400/60 hover:bg-[#1B283E] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Users className="h-4 w-4 text-amber-400" />
              <span>Two Player</span>
            </button>
          </div>
        </div>

        {/* Main 12-Column Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 Columns: Mode Shortcuts, Match Configurator & Recent Games */}
          <div className="lg:col-span-7 space-y-6">
            {/* Instant Mode Launch & Selection Cards */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#111927] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">
                  Choose Game Mode & Match Setup
                </h2>
                <span className="text-xs text-slate-400">
                  {selectedMode === 'ai'
                    ? 'Single-Player vs AI Engine'
                    : selectedMode === 'two-player'
                    ? 'Local Pass & Play'
                    : 'Free Analysis & Hints'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(
                  [
                    {
                      id: 'ai',
                      title: 'Play Computer',
                      subtitle: 'Easy, Medium & Hard AI',
                      icon: Bot,
                    },
                    {
                      id: 'two-player',
                      title: 'Two Player',
                      subtitle: 'Shared device board',
                      icon: Users,
                    },
                    {
                      id: 'practice',
                      title: 'Practice & Learn',
                      subtitle: 'Evaluated move hints',
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
                      className={`group flex flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all duration-150 ${
                        isActive
                          ? 'border-emerald-500 bg-[#142634] shadow-md shadow-emerald-950/30'
                          : 'border-slate-800/90 bg-[#0D131F] hover:border-slate-700 hover:bg-[#131C2E]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between mb-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800/80 text-slate-400 group-hover:text-slate-200'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
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
                        <div className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                          {modeCard.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {modeCard.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Difficulty & Side Configurator */}
              <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-12">
                <div className="sm:col-span-7 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-amber-400" />
                      Engine Difficulty
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {selectedDifficulty === 'easy'
                        ? 'Beginner-Friendly'
                        : selectedDifficulty === 'medium'
                        ? 'Intermediate Club'
                        : 'Master Tactical'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800/90 bg-[#0D131F] p-1">
                    {(
                      [
                        { id: 'easy', label: 'Easy', desc: 'Casual' },
                        { id: 'medium', label: 'Medium', desc: 'Balanced' },
                        { id: 'hard', label: 'Hard', desc: 'Strongest' },
                      ] as const
                    ).map((diff) => {
                      const active = selectedDifficulty === diff.id;
                      return (
                        <button
                          key={diff.id}
                          type="button"
                          data-testid={`difficulty-${diff.id}`}
                          onClick={() => onSelectDifficulty(diff.id)}
                          className={`flex flex-col items-center justify-center rounded-lg py-1.5 px-2 transition-colors ${
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

                {/* Player Color Choice */}
                <div className="sm:col-span-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Your Pieces
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {selectedColor === 'w'
                        ? 'White'
                        : selectedColor === 'b'
                        ? 'Black'
                        : 'Random'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800/90 bg-[#0D131F] p-1">
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
                                <ChessPieceSVG
                                  type="k"
                                  color="w"
                                  style={pieceStyle}
                                />
                              </div>
                            )}
                            {side.id === 'b' && (
                              <div className="h-4 w-4 rounded bg-[#EAE6DF]/90 p-0.5">
                                <ChessPieceSVG
                                  type="k"
                                  color="b"
                                  style={pieceStyle}
                                />
                              </div>
                            )}
                            {side.id === 'random' && (
                              <div className="flex items-center -space-x-1">
                                <div className="h-3.5 w-3.5">
                                  <ChessPieceSVG
                                    type="k"
                                    color="w"
                                    style={pieceStyle}
                                  />
                                </div>
                                <div className="h-3.5 w-3.5 rounded bg-[#EAE6DF]/90 p-0.5">
                                  <ChessPieceSVG
                                    type="k"
                                    color="b"
                                    style={pieceStyle}
                                  />
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

              {/* Time Control Selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    Time Control
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono-tabular">
                    {TIME_CONTROLS[selectedTimeControl].label} ·{' '}
                    {TIME_CONTROLS[selectedTimeControl].description}
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
                            : 'border-slate-800 bg-[#0D131F] text-slate-300 hover:border-slate-700'
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
            </div>

            {/* Recently Played Games Panel */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#111927] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white">
                    Recently Played Games
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    Saved locally in browser
                  </span>
                  {recentGames.length > 0 && onRequestClearHistory && (
                    <button
                      type="button"
                      data-testid="clear-recent-games-btn"
                      onClick={onRequestClearHistory}
                      className="rounded border border-slate-800 bg-[#0D131F] px-2 py-1 text-[11px] font-medium text-slate-400 hover:border-rose-500/40 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800/90 bg-[#0D131F]">
                {recentGames.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">
                    No recent games recorded yet. Complete a match to track your results here.
                  </div>
                ) : (
                  recentGames.slice(0, 4).map((game) => (
                    <div
                      key={game.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">
                            {game.opponent}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">{game.mode}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {game.reason} · {game.moves} moves · {game.timeControl} ·{' '}
                          {game.dateLabel}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`font-mono-tabular font-bold ${
                            game.result === 'Win'
                              ? 'text-emerald-400'
                              : game.result === 'Loss'
                              ? 'text-rose-400'
                              : 'text-amber-300'
                          }`}
                        >
                          {game.result} ({game.scoreLabel})
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Featured Chessboard Preview & Practice/Learning Quick Access */}
          <div className="lg:col-span-5 space-y-6">
            {/* Featured Chessboard Preview Card */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#111927] p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    Featured Board · Giuoco Piano
                  </span>
                </div>
                <span className="text-xs font-mono-tabular text-emerald-400">
                  {lastPreviewMove
                    ? `Move ${Math.ceil(previewStep / 2)}: ${lastPreviewMove.san}`
                    : 'Start Position'}
                </span>
              </div>

              <div
                className="grid aspect-square w-full max-w-[360px] mx-auto grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border-2 border-[#1E2E2A]"
                aria-label="Featured chessboard preview"
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
                        className={`relative flex items-center justify-center p-1 ${
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

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {hoveredPreviewSq
                    ? `Square ${hoveredPreviewSq.toUpperCase()}`
                    : 'Step through opening moves'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewStep((prev) =>
                        prev > 0 ? prev - 1 : SHOWCASE_MOVES.length
                      )
                    }
                    className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-200 hover:border-emerald-500/60"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewStep(
                        (prev) => (prev + 1) % (SHOWCASE_MOVES.length + 1)
                      )
                    }
                    className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-200 hover:border-emerald-500/60"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Training, Analysis & Puzzles Quick Access */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#111927] p-4 space-y-2.5">
              <h2 className="text-xs font-bold text-slate-300">
                Practice, Analysis & Training Tools
              </h2>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateSection('analysis')}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0D131F] p-3 text-left hover:border-emerald-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <Microscope className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Analysis & Free Practice Board
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Explore openings with live engine move hints & FEN
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('learn')}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0D131F] p-3 text-left hover:border-emerald-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Learn & Move Commentary
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Interactive move feedback · Course Library Coming Soon
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('puzzles')}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0D131F] p-3 text-left hover:border-emerald-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                      <Puzzle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Tactical Puzzles
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Daily Rated Puzzle Ladder — Coming Soon
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-amber-300/90">
                    Coming Soon
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
