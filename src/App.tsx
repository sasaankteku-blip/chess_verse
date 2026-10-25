/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Color, Move, PieceSymbol, Square } from 'chess.js';
import {
  Undo2,
  RotateCcw,
  FlipVertical2,
  Flag,
  Handshake,
  Volume2,
  VolumeX,
  Home,
  Settings,
  Lightbulb,
  Bot,
  Users,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Puzzle,
  Microscope,
  Play,
} from 'lucide-react';
import {
  analyzeMoveFeedback,
  calculateMaterialAndCaptures,
  Difficulty,
  evaluateBoard,
  EvaluatedHint,
  findBestMove,
  GameMode,
  getEvaluatedHint,
  groupMoveHistory,
  MoveFeedback,
  PlayerColorChoice,
  TIME_CONTROLS,
  TimeControl,
} from './game/engine';
import { AIWorkerResponse } from './game/ai.worker';
import { Chessboard } from './components/Chessboard';
import { ChessPieceSVG } from './components/ChessPieces';
import { HomeScreen } from './components/HomeScreen';
import {
  ConfirmModal,
  GameOverDetails,
  GameOverModal,
  SettingsModal,
} from './components/Modals';
import { NavDestination, Sidebar } from './components/Sidebar';
import {
  addRecentGame,
  clearRecentGames,
  formatGameTimestamp,
  loadPreferences,
  loadRecentGames,
  RecentGameRecord,
  savePreferences,
  UserPreferences,
} from './utils/preferences';
import { soundFX } from './utils/sound';

type AppView = 'title' | 'playing' | 'coming-soon';
type MobilePanelTab = 'moves' | 'insight' | 'setup';

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function App() {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadPreferences()
  );
  const [recentGames, setRecentGames] = useState<RecentGameRecord[]>(() =>
    loadRecentGames()
  );
  const [mobilePanelTab, setMobilePanelTab] =
    useState<MobilePanelTab>('moves');

  // Check ?autostart=1 for instant gameplay launch
  const [view, setView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [activeNav, setActiveNav] = useState<NavDestination>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'play-computer';
    }
    return 'home';
  });

  // Match setup state
  const [gameMode, setGameMode] = useState<GameMode>(
    () => loadPreferences().defaultGameMode
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => loadPreferences().defaultDifficulty
  );
  const [playerColorChoice, setPlayerColorChoice] =
    useState<PlayerColorChoice>('w');
  const [timeControl, setTimeControl] = useState<TimeControl>(
    () => loadPreferences().defaultTimeControl
  );

  // Active game state
  const chessRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(chessRef.current.fen());
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [humanColor, setHumanColor] = useState<Color>('w');
  const [boardOrientation, setBoardOrientation] = useState<Color>('w');

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null
  );
  const [hintMove, setHintMove] = useState<EvaluatedHint | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null);

  const [isAIThinking, setIsAIThinking] = useState<boolean>(false);
  const [gameOverDetails, setGameOverDetails] =
    useState<GameOverDetails | null>(null);
  const [isGameOverModalOpen, setIsGameOverModalOpen] =
    useState<boolean>(false);

  // Clocks (in seconds for display + millisecond refs for accurate elapsed-time tracking)
  const [whiteTime, setWhiteTime] = useState<number>(
    TIME_CONTROLS[timeControl].seconds
  );
  const [blackTime, setBlackTime] = useState<number>(
    TIME_CONTROLS[timeControl].seconds
  );
  const whiteTimeMsRef = useRef<number>(
    TIME_CONTROLS[timeControl].seconds * 1000
  );
  const blackTimeMsRef = useRef<number>(
    TIME_CONTROLS[timeControl].seconds * 1000
  );
  const lastTickTimeRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  );
  const clockHistoryRef = useRef<{ whiteMs: number; blackMs: number }[]>([]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant?: 'danger' | 'emerald';
    onConfirm: () => void;
  } | null>(null);

  const moveListEndRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const aiRequestIdRef = useRef<number>(0);

  // Sync sound setting
  useEffect(() => {
    soundFX.setEnabled(preferences.soundEnabled);
  }, [preferences.soundEnabled]);

  // Sync body dataset state for testing and game shell hygiene
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (view === 'title') {
        document.body.dataset.state = 'title';
      } else if (isGameOverModalOpen || gameOverDetails) {
        document.body.dataset.state = 'gameover';
      } else if (isSettingsOpen || confirmDialog?.isOpen) {
        document.body.dataset.state = 'paused';
      } else {
        document.body.dataset.state = 'playing';
      }
    }
  }, [view, isGameOverModalOpen, gameOverDetails, isSettingsOpen, confirmDialog]);

  const updatePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...partial };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const recordCompletedGame = useCallback(
    (winner: 'w' | 'b' | 'draw', reasonLabel: string) => {
      const movesPlayed = Math.max(
        1,
        Math.ceil(chessRef.current.history().length / 2)
      );
      let result: 'Win' | 'Loss' | 'Draw' = 'Draw';
      if (winner !== 'draw') {
        if (gameMode === 'ai') {
          result = winner === humanColor ? 'Win' : 'Loss';
        } else {
          result = winner === 'w' ? 'Win' : 'Loss';
        }
      }

      const record: RecentGameRecord = {
        id: `game-${Date.now()}`,
        mode:
          gameMode === 'ai'
            ? 'Play Computer'
            : gameMode === 'two-player'
            ? 'Two Player'
            : 'Practice',
        opponent:
          gameMode === 'ai'
            ? `ChessVerse AI (${difficulty.toUpperCase()})`
            : gameMode === 'two-player'
            ? 'Local Opponent'
            : 'Analysis Board',
        result,
        scoreLabel:
          winner === 'w' ? '1–0' : winner === 'b' ? '0–1' : '½–½',
        reason: reasonLabel,
        moves: movesPlayed,
        timeControl: `${TIME_CONTROLS[timeControl].label}`,
        dateLabel: formatGameTimestamp(new Date()),
        finalFen: chessRef.current.fen(),
      };
      setRecentGames(addRecentGame(record));
    },
    [gameMode, difficulty, humanColor, timeControl]
  );

  // Initialize Web Worker for AI
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('./game/ai.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      workerRef.current = null;
    }
  }, []);

  // Scroll move history to bottom on new move
  useEffect(() => {
    moveListEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [moveHistory.length]);

  const materialSummary = calculateMaterialAndCaptures(fen);
  const materialAdvantageLabel =
    materialSummary.advantage === 0
      ? 'Equal'
      : materialSummary.advantage > 0
      ? `White +${materialSummary.advantage}`
      : `Black +${Math.abs(materialSummary.advantage)}`;

  const checkAndHandleGameOver = useCallback(
    (chessInstance: Chess) => {
      if (!chessInstance.isGameOver()) return false;

      const movesCount = Math.ceil(chessInstance.history().length / 2);
      const matSummary = calculateMaterialAndCaptures(chessInstance.fen());
      const matText =
        matSummary.advantage === 0
          ? 'Equal (0)'
          : matSummary.advantage > 0
          ? `W +${matSummary.advantage}`
          : `B +${Math.abs(matSummary.advantage)}`;

      let details: GameOverDetails;

      if (chessInstance.isCheckmate()) {
        const winnerColor: Color = chessInstance.turn() === 'w' ? 'b' : 'w';
        const winnerName = winnerColor === 'w' ? 'White' : 'Black';
        details = {
          title: 'Checkmate!',
          subtitle: `${winnerName} Wins the Match`,
          winner: winnerColor,
          reason: `${
            winnerColor === 'w' ? 'Black' : 'White'
          }'s King has no legal escape from check.`,
          totalMoves: movesCount,
          materialAdvantage: matText,
        };
        soundFX.playGameOver(gameMode !== 'ai' || winnerColor === humanColor);
        recordCompletedGame(winnerColor, 'Checkmate');
      } else if (chessInstance.isStalemate()) {
        details = {
          title: 'Draw by Stalemate',
          subtitle: 'Match Drawn (½ – ½)',
          winner: 'draw',
          reason: `${
            chessInstance.turn() === 'w' ? 'White' : 'Black'
          } has no legal moves available, and the King is not in check.`,
          totalMoves: movesCount,
          materialAdvantage: matText,
        };
        soundFX.playGameOver(false);
        recordCompletedGame('draw', 'Stalemate');
      } else if (chessInstance.isThreefoldRepetition()) {
        details = {
          title: 'Draw by Repetition',
          subtitle: 'Threefold Repetition Rule',
          winner: 'draw',
          reason: 'The exact same board position has been repeated three times.',
          totalMoves: movesCount,
          materialAdvantage: matText,
        };
        soundFX.playGameOver(false);
        recordCompletedGame('draw', 'Repetition');
      } else if (chessInstance.isInsufficientMaterial()) {
        details = {
          title: 'Draw — Insufficient Material',
          subtitle: 'Neither Side Can Force Checkmate',
          winner: 'draw',
          reason:
            'There are not enough pieces remaining on the board to deliver checkmate.',
          totalMoves: movesCount,
          materialAdvantage: matText,
        };
        soundFX.playGameOver(false);
        recordCompletedGame('draw', 'Insufficient Material');
      } else {
        details = {
          title: 'Match Drawn',
          subtitle: 'Fifty-Move Rule',
          winner: 'draw',
          reason:
            'Fifty consecutive moves have been played without a pawn advance or piece capture.',
          totalMoves: movesCount,
          materialAdvantage: matText,
        };
        soundFX.playGameOver(false);
        recordCompletedGame('draw', '50-Move Rule');
      }

      setGameOverDetails(details);
      setIsGameOverModalOpen(true);
      setIsAIThinking(false);
      return true;
    },
    [gameMode, humanColor, recordCompletedGame]
  );

  // Trigger AI move when it is AI's turn in 'ai' mode
  useEffect(() => {
    if (view !== 'playing' || gameMode !== 'ai' || gameOverDetails) return;

    const currentTurn = chessRef.current.turn();
    if (currentTurn === humanColor || chessRef.current.isGameOver()) return;

    setIsAIThinking(true);
    const requestId = ++aiRequestIdRef.current;
    const currentFen = chessRef.current.fen();

    const applyAIMove = (from: string, to: string, promotion?: string) => {
      if (requestId !== aiRequestIdRef.current) return;
      try {
        const preMoveClocks = {
          whiteMs: whiteTimeMsRef.current,
          blackMs: blackTimeMsRef.current,
        };
        const moveObj = chessRef.current.move({
          from,
          to,
          promotion: promotion || 'q',
        });
        if (moveObj) {
          clockHistoryRef.current.push(preMoveClocks);
          lastTickTimeRef.current =
            typeof performance !== 'undefined' ? performance.now() : Date.now();
          setFen(chessRef.current.fen());
          setMoveHistory(chessRef.current.history({ verbose: true }));
          setLastMove({ from: moveObj.from, to: moveObj.to });
          setSelectedSquare(null);
          setHintMove(null);
          setMoveFeedback(analyzeMoveFeedback(chessRef.current, moveObj));

          if (chessRef.current.inCheck()) {
            soundFX.playCheck();
          } else if (moveObj.captured) {
            soundFX.playCapture();
          } else if (
            moveObj.flags.includes('k') ||
            moveObj.flags.includes('q')
          ) {
            soundFX.playCastle();
          } else {
            soundFX.playMove();
          }

          checkAndHandleGameOver(chessRef.current);
        }
      } finally {
        setIsAIThinking(false);
      }
    };

    const timer = setTimeout(() => {
      if (workerRef.current) {
        const handleMessage = (
          event: MessageEvent<AIWorkerResponse & { error?: boolean }>
        ) => {
          if (event.data.id !== requestId) return;
          workerRef.current?.removeEventListener('message', handleMessage);
          if (!event.data.error && event.data.from && event.data.to) {
            applyAIMove(event.data.from, event.data.to, event.data.promotion);
          } else {
            setIsAIThinking(false);
          }
        };
        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          id: requestId,
          fen: currentFen,
          difficulty,
        });
      } else {
        const fallbackResult = findBestMove(currentFen, difficulty);
        if (fallbackResult) {
          applyAIMove(
            fallbackResult.move.from,
            fallbackResult.move.to,
            fallbackResult.move.promotion
          );
        } else {
          setIsAIThinking(false);
        }
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [
    view,
    gameMode,
    fen,
    humanColor,
    difficulty,
    gameOverDetails,
    checkAndHandleGameOver,
  ]);

  // Accurate Elapsed-Time Chess Clocks Countdown (handles tab inactivity safely)
  useEffect(() => {
    if (
      view !== 'playing' ||
      timeControl === 'unlimited' ||
      Boolean(gameOverDetails) ||
      isSettingsOpen ||
      Boolean(confirmDialog?.isOpen)
    ) {
      return;
    }

    const getNow = () =>
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    lastTickTimeRef.current = getNow();

    const handleVisibilityChange = () => {
      lastTickTimeRef.current = getNow();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    const interval = setInterval(() => {
      const now = getNow();
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        lastTickTimeRef.current = now;
        return;
      }

      // Cap single tick delta at 1000ms to prevent background throttling spikes
      const elapsedMs = Math.max(0, Math.min(now - lastTickTimeRef.current, 1000));
      lastTickTimeRef.current = now;

      const activeTurn = chessRef.current.turn();
      if (activeTurn === 'w') {
        const nextWhiteMs = Math.max(0, whiteTimeMsRef.current - elapsedMs);
        whiteTimeMsRef.current = nextWhiteMs;
        setWhiteTime(Math.ceil(nextWhiteMs / 1000));

        if (nextWhiteMs <= 0) {
          clearInterval(interval);
          aiRequestIdRef.current++;
          setIsAIThinking(false);
          soundFX.playGameOver(false);
          recordCompletedGame('b', 'Time Out');
          setGameOverDetails({
            title: 'Time Out!',
            subtitle: 'Black Wins on Time',
            winner: 'b',
            reason: "White's chess clock expired before completing the game.",
            totalMoves: Math.ceil(chessRef.current.history().length / 2),
            materialAdvantage: materialAdvantageLabel,
          });
          setIsGameOverModalOpen(true);
        }
      } else {
        const nextBlackMs = Math.max(0, blackTimeMsRef.current - elapsedMs);
        blackTimeMsRef.current = nextBlackMs;
        setBlackTime(Math.ceil(nextBlackMs / 1000));

        if (nextBlackMs <= 0) {
          clearInterval(interval);
          aiRequestIdRef.current++;
          setIsAIThinking(false);
          soundFX.playGameOver(true);
          recordCompletedGame('w', 'Time Out');
          setGameOverDetails({
            title: 'Time Out!',
            subtitle: 'White Wins on Time',
            winner: 'w',
            reason: "Black's chess clock expired before completing the game.",
            totalMoves: Math.ceil(chessRef.current.history().length / 2),
            materialAdvantage: materialAdvantageLabel,
          });
          setIsGameOverModalOpen(true);
        }
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [
    view,
    timeControl,
    gameOverDetails,
    isSettingsOpen,
    confirmDialog?.isOpen,
    materialAdvantageLabel,
    recordCompletedGame,
  ]);

  const startNewGame = useCallback(
    (overrideMode?: GameMode, navOverride?: NavDestination) => {
      const targetMode = overrideMode || gameMode;
      if (overrideMode) setGameMode(overrideMode);

      aiRequestIdRef.current++;
      setIsAIThinking(false);

      const newChess = new Chess();
      chessRef.current = newChess;
      setFen(newChess.fen());
      setMoveHistory([]);
      setSelectedSquare(null);
      setLastMove(null);
      setHintMove(null);
      setMoveFeedback(null);
      setGameOverDetails(null);
      setIsGameOverModalOpen(false);

      let assignedColor: Color = 'w';
      if (targetMode === 'ai') {
        if (playerColorChoice === 'random') {
          assignedColor = Math.random() < 0.5 ? 'w' : 'b';
        } else {
          assignedColor = playerColorChoice;
        }
      }
      setHumanColor(assignedColor);
      setBoardOrientation(assignedColor);

      const initialSeconds = TIME_CONTROLS[timeControl].seconds;
      whiteTimeMsRef.current = initialSeconds * 1000;
      blackTimeMsRef.current = initialSeconds * 1000;
      clockHistoryRef.current = [];
      lastTickTimeRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      setWhiteTime(initialSeconds);
      setBlackTime(initialSeconds);

      if (navOverride) {
        setActiveNav(navOverride);
      } else {
        setActiveNav(
          targetMode === 'ai'
            ? 'play-computer'
            : targetMode === 'two-player'
            ? 'two-player'
            : 'learn'
        );
      }

      setView('playing');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [gameMode, playerColorChoice, timeControl]
  );

  const handleNavigate = useCallback(
    (dest: NavDestination) => {
      setActiveNav(dest);
      if (dest === 'home') {
        aiRequestIdRef.current++;
        setIsAIThinking(false);
        setView('title');
        return;
      }
      if (dest === 'play') {
        startNewGame(gameMode, 'play');
        return;
      }
      if (dest === 'play-computer') {
        startNewGame('ai', 'play-computer');
        return;
      }
      if (dest === 'two-player') {
        startNewGame('two-player', 'two-player');
        return;
      }
      if (dest === 'learn' || dest === 'analysis') {
        startNewGame('practice', dest);
        return;
      }
      if (dest === 'puzzles') {
        aiRequestIdRef.current++;
        setIsAIThinking(false);
        setView('coming-soon');
      }
    },
    [gameMode, startNewGame]
  );

  // Keyboard shortcuts on title and playing screens
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (view === 'title') {
        if ((e.key === 'Enter' || e.key === ' ') && !isSettingsOpen) {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (view === 'playing') {
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'));
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          updatePreferences({ soundEnabled: !preferences.soundEnabled });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    view,
    isSettingsOpen,
    startNewGame,
    preferences.soundEnabled,
    updatePreferences,
  ]);

  const handleMovePiece = (
    from: Square,
    to: Square,
    promotion: PieceSymbol = 'q'
  ): boolean => {
    if (isAIThinking || Boolean(gameOverDetails)) return false;
    if (gameMode === 'ai' && chessRef.current.turn() !== humanColor) {
      return false;
    }

    try {
      const preMoveClocks = {
        whiteMs: whiteTimeMsRef.current,
        blackMs: blackTimeMsRef.current,
      };
      const moveResult = chessRef.current.move({
        from,
        to,
        promotion,
      });
      if (!moveResult) return false;

      clockHistoryRef.current.push(preMoveClocks);
      lastTickTimeRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      setFen(chessRef.current.fen());
      setMoveHistory(chessRef.current.history({ verbose: true }));
      setLastMove({ from: moveResult.from, to: moveResult.to });
      setSelectedSquare(null);
      setHintMove(null);
      setMoveFeedback(analyzeMoveFeedback(chessRef.current, moveResult));

      if (chessRef.current.inCheck()) {
        soundFX.playCheck();
      } else if (moveResult.captured) {
        soundFX.playCapture();
      } else if (
        moveResult.flags.includes('k') ||
        moveResult.flags.includes('q')
      ) {
        soundFX.playCastle();
      } else {
        soundFX.playMove();
      }

      checkAndHandleGameOver(chessRef.current);
      return true;
    } catch {
      return false;
    }
  };

  const handleSquareClick = (sq: Square) => {
    if (isAIThinking || Boolean(gameOverDetails)) return;
    if (gameMode === 'ai' && chessRef.current.turn() !== humanColor) return;

    if (selectedSquare === sq) {
      setSelectedSquare(null);
      return;
    }

    const pieceOnClicked = chessRef.current.get(sq);
    if (pieceOnClicked && pieceOnClicked.color === chessRef.current.turn()) {
      setSelectedSquare(sq);
      return;
    }

    setSelectedSquare(null);
  };

  const handleUndoMove = () => {
    if (moveHistory.length === 0 || isAIThinking) return;

    aiRequestIdRef.current++;

    let pliesUndone = 0;
    if (gameMode === 'ai') {
      if (chessRef.current.turn() === humanColor && moveHistory.length >= 2) {
        chessRef.current.undo();
        chessRef.current.undo();
        pliesUndone = 2;
      } else {
        chessRef.current.undo();
        pliesUndone = 1;
      }
    } else {
      chessRef.current.undo();
      pliesUndone = 1;
    }

    // Restore clock state from before the undone ply(s)
    let restoredClock: { whiteMs: number; blackMs: number } | undefined;
    for (let i = 0; i < pliesUndone; i++) {
      restoredClock = clockHistoryRef.current.pop();
    }
    if (restoredClock) {
      whiteTimeMsRef.current = restoredClock.whiteMs;
      blackTimeMsRef.current = restoredClock.blackMs;
      setWhiteTime(Math.ceil(restoredClock.whiteMs / 1000));
      setBlackTime(Math.ceil(restoredClock.blackMs / 1000));
    }
    lastTickTimeRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    const updatedHistory = chessRef.current.history({ verbose: true });
    const previousMove = updatedHistory[updatedHistory.length - 1];

    setFen(chessRef.current.fen());
    setMoveHistory(updatedHistory);
    setLastMove(
      previousMove ? { from: previousMove.from, to: previousMove.to } : null
    );
    setSelectedSquare(null);
    setHintMove(null);
    setGameOverDetails(null);
    setIsGameOverModalOpen(false);
    setMoveFeedback(
      previousMove ? analyzeMoveFeedback(chessRef.current, previousMove) : null
    );
    soundFX.playMove();
  };

  const handleRequestRestart = () => {
    if (moveHistory.length > 0 && !gameOverDetails) {
      setConfirmDialog({
        isOpen: true,
        title: 'Start a New Game?',
        message:
          'Your current game is still in progress. Are you sure you want to reset the board and start a fresh match?',
        confirmLabel: 'Start New Game',
        variant: 'emerald',
        onConfirm: () => {
          setConfirmDialog(null);
          startNewGame();
        },
      });
    } else {
      startNewGame();
    }
  };

  const handleRequestResign = () => {
    if (gameOverDetails) return;
    const resigningSide =
      gameMode === 'ai' ? humanColor : chessRef.current.turn();
    const resigningLabel = resigningSide === 'w' ? 'White' : 'Black';
    const winnerSide: Color = resigningSide === 'w' ? 'b' : 'w';
    const winnerLabel = winnerSide === 'w' ? 'White' : 'Black';

    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Resignation',
      message: `Are you sure ${resigningLabel} wants to resign this match? ${winnerLabel} will be awarded the victory.`,
      confirmLabel: 'Resign Match',
      variant: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        soundFX.playGameOver(false);
        recordCompletedGame(winnerSide, 'Resignation');
        setGameOverDetails({
          title: `${winnerLabel} Wins by Resignation`,
          subtitle: `${resigningLabel} Resigned the Match`,
          winner: winnerSide,
          reason: `${resigningLabel} conceded the game.`,
          totalMoves: Math.ceil(chessRef.current.history().length / 2),
          materialAdvantage: materialAdvantageLabel,
        });
        setIsGameOverModalOpen(true);
      },
    });
  };

  const handleOfferDraw = () => {
    if (gameOverDetails) return;

    if (gameMode === 'ai') {
      const evalScore =
        humanColor === 'w'
          ? materialSummary.advantage
          : -materialSummary.advantage;
      const canAccept = moveHistory.length >= 8 && evalScore >= -1;

      if (canAccept) {
        soundFX.playGameOver(false);
        recordCompletedGame('draw', 'Mutual Agreement');
        setGameOverDetails({
          title: 'Draw by Agreement',
          subtitle: 'AI Accepted Your Draw Offer (½ – ½)',
          winner: 'draw',
          reason: 'Both sides agreed to a draw in a balanced position.',
          totalMoves: Math.ceil(chessRef.current.history().length / 2),
          materialAdvantage: materialAdvantageLabel,
        });
        setIsGameOverModalOpen(true);
      } else {
        setConfirmDialog({
          isOpen: true,
          title: 'Draw Offer Declined',
          message:
            moveHistory.length < 8
              ? 'The AI prefers to play out the opening phase (at least 4 full moves) before considering a draw.'
              : 'The AI evaluates its current position as favorable and wishes to continue playing.',
          confirmLabel: 'Continue Playing',
          variant: 'emerald',
          onConfirm: () => setConfirmDialog(null),
        });
      }
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Agree to a Draw?',
      message:
        'Does the opposing player accept the draw offer and end this game as a ½ – ½ tie?',
      confirmLabel: 'Accept Draw',
      variant: 'emerald',
      onConfirm: () => {
        setConfirmDialog(null);
        soundFX.playGameOver(false);
        recordCompletedGame('draw', 'Mutual Agreement');
        setGameOverDetails({
          title: 'Draw by Mutual Agreement',
          subtitle: 'Match Drawn (½ – ½)',
          winner: 'draw',
          reason:
            'Both players mutually agreed to conclude the match in a draw.',
          totalMoves: Math.ceil(chessRef.current.history().length / 2),
          materialAdvantage: materialAdvantageLabel,
        });
        setIsGameOverModalOpen(true);
      },
    });
  };

  const handleShowHint = () => {
    if (gameOverDetails || isAIThinking) return;
    const evaluated = getEvaluatedHint(chessRef.current.fen());
    if (evaluated) {
      setHintMove(evaluated);
    }
  };

  const handleSelectTimeControlPreset = (preset: TimeControl) => {
    setTimeControl(preset);
    const secs = TIME_CONTROLS[preset].seconds;
    whiteTimeMsRef.current = secs * 1000;
    blackTimeMsRef.current = secs * 1000;
    clockHistoryRef.current = [];
    lastTickTimeRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    setWhiteTime(secs);
    setBlackTime(secs);
  };

  const handleRequestClearHistory = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Recent Games?',
      message:
        'Are you sure you want to remove all saved match records from your browser history?',
      confirmLabel: 'Clear History',
      variant: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        setRecentGames(clearRecentGames());
      },
    });
  };

  const legalMovesForSelected = selectedSquare
    ? chessRef.current.moves({ square: selectedSquare, verbose: true })
    : [];

  const currentTurn = chessRef.current.turn();
  const inCheck = chessRef.current.inCheck();
  const movePairs = groupMoveHistory(moveHistory);

  // Live position evaluation (centipawns -> pawns & visual bar percentage)
  const rawEvalCentipawns = evaluateBoard(chessRef.current);
  const evalPawns = rawEvalCentipawns / 100;
  const evalFormatted = chessRef.current.isCheckmate()
    ? currentTurn === 'w'
      ? '0-1'
      : '1-0'
    : `${evalPawns >= 0 ? '+' : ''}${evalPawns.toFixed(1)}`;
  // Clamp between 6% and 94% for smooth visual gauge
  const whiteAdvantagePct = chessRef.current.isCheckmate()
    ? currentTurn === 'w'
      ? 0
      : 100
    : Math.min(94, Math.max(6, 50 + Math.tanh(evalPawns / 4.5) * 44));

  const topColor: Color = boardOrientation === 'w' ? 'b' : 'w';
  const bottomColor: Color = boardOrientation;

  const getPlayerLabel = (color: Color): string => {
    const colorName = color === 'w' ? 'White' : 'Black';
    if (gameMode === 'two-player') {
      return color === 'w' ? 'Player 1 — White' : 'Player 2 — Black';
    }
    if (gameMode === 'practice') {
      return activeNav === 'analysis'
        ? `Analysis — ${colorName}`
        : `Practice — ${colorName}`;
    }
    if (color === humanColor) {
      return `You — ${colorName}`;
    }
    return `ChessVerse AI (${difficulty.toUpperCase()}) — ${colorName}`;
  };

  const getPlayerRatingBadge = (color: Color): string => {
    if (gameMode === 'two-player') return 'LOCAL';
    if (gameMode === 'practice') return 'FREE';
    if (color === humanColor) return 'PLAYER';
    return difficulty === 'easy'
      ? 'DEPTH 1'
      : difficulty === 'medium'
      ? 'DEPTH 2'
      : 'DEPTH 3+';
  };

  return (
    <div className="min-h-screen w-full bg-[#0B101B] text-[#F4F2ED] flex flex-col lg:flex-row">
      {/* LEFT: Persistent Navigation Sidebar */}
      <Sidebar
        activeNav={activeNav}
        onNavigate={handleNavigate}
        onOpenSettings={() => setIsSettingsOpen(true)}
        collapsed={preferences.sidebarCollapsed}
        onToggleCollapse={() =>
          updatePreferences({
            sidebarCollapsed: !preferences.sidebarCollapsed,
          })
        }
        soundEnabled={preferences.soundEnabled}
        onToggleSound={() =>
          updatePreferences({ soundEnabled: !preferences.soundEnabled })
        }
      />

      {/* RIGHT / MAIN WORKSPACE */}
      {view === 'title' ? (
        <HomeScreen
          selectedMode={gameMode}
          onSelectMode={setGameMode}
          selectedDifficulty={difficulty}
          onSelectDifficulty={setDifficulty}
          selectedColor={playerColorChoice}
          onSelectColor={setPlayerColorChoice}
          selectedTimeControl={timeControl}
          onSelectTimeControl={setTimeControl}
          onStartGame={(overrideMode) => startNewGame(overrideMode)}
          onNavigateSection={handleNavigate}
          recentGames={recentGames}
          onRequestClearHistory={handleRequestClearHistory}
          pieceStyle={preferences.pieceStyle}
        />
      ) : view === 'coming-soon' ? (
        <main
          data-testid="puzzles-coming-soon-view"
          className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"
        >
          <div className="max-w-lg rounded-2xl border border-slate-800/90 bg-[#111927] p-8 shadow-2xl space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
              <Puzzle className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Coming Soon to ChessVerse
              </div>
              <h1 className="font-display text-3xl font-bold text-white">
                Rated Tactical Puzzles & Rush Ladder
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Curated tactical puzzle packs, motif-based pattern drills (forks, pins, skewers, and back-rank mates), and timed Puzzle Rush leaderboards are currently in development.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => startNewGame('ai', 'play-computer')}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Play vs Computer Now</span>
              </button>
              <button
                type="button"
                onClick={() => startNewGame('practice', 'analysis')}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#162033] px-5 py-3 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors cursor-pointer"
              >
                <Microscope className="h-4 w-4 text-emerald-400" />
                <span>Open Analysis & Hint Board</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* THREE-AREA GAMEPLAY WORKSPACE (CENTER BOARD + RIGHT COMMAND PANEL) */
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Compact Top Status Sub-Bar */}
          <header className="border-b border-slate-800/80 bg-[#0F1624] px-4 py-2 sm:px-6">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('home')}
                  data-testid="return-home-btn"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#151F32] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Home className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Return to Home</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    {gameMode === 'ai' && <Bot className="h-3.5 w-3.5" />}
                    {gameMode === 'two-player' && (
                      <Users className="h-3.5 w-3.5" />
                    )}
                    {gameMode === 'practice' && (
                      <GraduationCap className="h-3.5 w-3.5" />
                    )}
                    {gameMode === 'ai'
                      ? `Play Computer (${difficulty.toUpperCase()})`
                      : gameMode === 'two-player'
                      ? 'Two Player Local Match'
                      : activeNav === 'analysis'
                      ? 'Analysis & Position Explorer'
                      : 'Learn & Practice Mode'}
                  </span>
                  <span>·</span>
                  <span className="font-mono-tabular text-slate-300">
                    {TIME_CONTROLS[timeControl].label} (
                    {TIME_CONTROLS[timeControl].description})
                  </span>
                </div>
              </div>

              {/* Center Turn / Thinking Status */}
              <div
                data-testid="turn-status-banner"
                className="flex items-center gap-2 text-xs font-semibold"
              >
                {isAIThinking ? (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Computer Thinking...</span>
                  </span>
                ) : gameOverDetails ? (
                  <span className="text-amber-400">
                    {gameOverDetails.title}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full border ${
                        currentTurn === 'w'
                          ? 'bg-white border-slate-400'
                          : 'bg-slate-900 border-amber-400'
                      }`}
                    />
                    <span className="text-slate-100">
                      {currentTurn === 'w' ? "White's Turn" : "Black's Turn"}
                    </span>
                    {inCheck && (
                      <span className="text-rose-400 font-bold">· CHECK!</span>
                    )}
                  </span>
                )}
              </div>

              {/* Right Quick Board Utility Controls (Desktop) */}
              <div className="hidden lg:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'))
                  }
                  aria-label="Flip Board"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#151F32] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FlipVertical2 className="h-3.5 w-3.5 text-amber-400" />
                  <span>Flip Board</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updatePreferences({
                      soundEnabled: !preferences.soundEnabled,
                    })
                  }
                  aria-label={
                    preferences.soundEnabled
                      ? 'Sound On (Click to Mute)'
                      : 'Sound Off (Click to Unmute)'
                  }
                  data-testid="sound-toggle-btn"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#151F32] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {preferences.soundEnabled ? (
                    <>
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Sound On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                      <span>Sound Off</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  aria-label="Open Settings"
                  data-testid="open-settings-btn"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#151F32] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-amber-400" />
                  <span>Settings</span>
                </button>
              </div>
            </div>
          </header>

          {/* CENTER BOARD + RIGHT PANEL GRID */}
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-3 sm:px-5 lg:flex-row lg:items-start lg:justify-center lg:gap-4 xl:gap-6 lg:py-4">
            {/* CENTER AREA: Player Bar (Top) + Eval Gauge & 8x8 Chessboard + Player Bar (Bottom) */}
            <div className="flex flex-1 min-w-0 flex-col items-center justify-center w-full">
              {/* Top Player Bar */}
              <div
                data-testid="top-player-bar"
                className={`mb-2 flex w-full max-w-[min(72vh,640px)] lg:max-w-[min(64vh,430px)] xl:max-w-[min(72vh,640px)] items-center justify-between rounded-xl border px-3.5 py-2 transition-colors ${
                  currentTurn === topColor && !gameOverDetails
                    ? 'border-emerald-500/70 bg-[#132232] shadow-md shadow-emerald-950/30'
                    : 'border-slate-800/90 bg-[#111827]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      topColor === 'b'
                        ? 'border-amber-400/40 bg-[#EAE6DF]'
                        : 'border-slate-700 bg-slate-800/90'
                    }`}
                  >
                    <div className="h-6 w-6">
                      <ChessPieceSVG
                        type="k"
                        color={topColor}
                        style={preferences.pieceStyle}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs sm:text-sm font-bold text-white">
                        {getPlayerLabel(topColor)}
                      </span>
                      <span className="hidden sm:inline-block shrink-0 whitespace-nowrap rounded bg-slate-800/90 px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-slate-300">
                        {getPlayerRatingBadge(topColor)}
                      </span>
                      {materialSummary.advantageColor === topColor && (
                        <span className="shrink-0 whitespace-nowrap rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-mono-tabular font-bold text-emerald-400">
                          +{Math.abs(materialSummary.advantage)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 min-h-[18px] mt-0.5">
                      {(topColor === 'w'
                        ? materialSummary.capturedByWhite
                        : materialSummary.capturedByBlack
                      ).map((pieceType, idx) => (
                        <div
                          key={idx}
                          className={`h-4 w-4 rounded-sm p-0.5 ${
                            topColor === 'w' ? 'bg-[#EAE6DF]/85' : ''
                          }`}
                        >
                          <ChessPieceSVG
                            type={pieceType}
                            color={topColor === 'w' ? 'b' : 'w'}
                            style={preferences.pieceStyle}
                          />
                        </div>
                      ))}
                      {(topColor === 'w'
                        ? materialSummary.capturedByWhite
                        : materialSummary.capturedByBlack
                      ).length === 0 && (
                        <span className="text-[11px] text-slate-400">
                          No captures yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'))
                    }
                    title="Flip Board (F)"
                    aria-label="Flip Board Orientation"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-emerald-500/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <FlipVertical2 className="h-3.5 w-3.5 text-amber-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updatePreferences({
                        soundEnabled: !preferences.soundEnabled,
                      })
                    }
                    title={
                      preferences.soundEnabled
                        ? 'Mute Sound (M)'
                        : 'Unmute Sound (M)'
                    }
                    aria-label={
                      preferences.soundEnabled ? 'Mute Sound' : 'Unmute Sound'
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-emerald-500/50 hover:text-white transition-colors cursor-pointer"
                  >
                    {preferences.soundEnabled ? (
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </button>
                  {timeControl !== 'unlimited' ? (
                    <div
                      data-testid={`clock-display-${topColor}`}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono-tabular text-sm sm:text-base font-bold ${
                        currentTurn === topColor && !gameOverDetails
                          ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {formatClock(topColor === 'w' ? whiteTime : blackTime)}
                      </span>
                    </div>
                  ) : (
                    <div
                      data-testid={`clock-display-${topColor}`}
                      className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-slate-400"
                    >
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span>∞</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Center Row: Live Evaluation Bar + 8x8 Interactive Chessboard */}
              <div className="flex w-full max-w-[min(72vh,640px)] lg:max-w-[min(64vh,430px)] xl:max-w-[min(72vh,640px)] items-stretch justify-center gap-2">
                {/* Vertical Live Evaluation Gauge */}
                <div
                  data-testid="evaluation-bar"
                  title={`Position Evaluation: ${evalFormatted}`}
                  className="hidden sm:flex w-4 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-800 bg-[#1B2434] shadow-inner relative"
                >
                  <div
                    className="w-full transition-all duration-500 ease-out"
                    style={{
                      height: `${
                        boardOrientation === 'w'
                          ? 100 - whiteAdvantagePct
                          : whiteAdvantagePct
                      }%`,
                      backgroundColor:
                        boardOrientation === 'w' ? '#1E293B' : '#EAE6DF',
                    }}
                  />
                  <div
                    className="w-full flex-1 transition-all duration-500 ease-out"
                    style={{
                      backgroundColor:
                        boardOrientation === 'w' ? '#EAE6DF' : '#1E293B',
                    }}
                  />
                  {/* Center equilibrium tick */}
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[1.5px] bg-emerald-500/70" />
                </div>

                {/* 8x8 Interactive Chessboard */}
                <div className="flex-1 flex justify-center">
                  <Chessboard
                    chess={chessRef.current}
                    boardOrientation={boardOrientation}
                    selectedSquare={selectedSquare}
                    legalMovesForSelected={legalMovesForSelected}
                    lastMove={lastMove}
                    hintMove={hintMove}
                    onSquareClick={handleSquareClick}
                    onMovePiece={handleMovePiece}
                    theme={preferences.boardTheme}
                    pieceStyle={preferences.pieceStyle}
                    showCoordinates={preferences.showCoordinates}
                    showLegalMoves={preferences.showLegalMoves}
                    enableAnimations={preferences.enableAnimations}
                    disabled={isAIThinking || Boolean(gameOverDetails)}
                  />
                </div>
              </div>

              {/* Bottom Player Bar */}
              <div
                data-testid="bottom-player-bar"
                className={`mt-2 flex w-full max-w-[min(72vh,640px)] lg:max-w-[min(64vh,430px)] xl:max-w-[min(72vh,640px)] items-center justify-between rounded-xl border px-3.5 py-2 transition-colors ${
                  currentTurn === bottomColor && !gameOverDetails
                    ? 'border-emerald-500/70 bg-[#132232] shadow-md shadow-emerald-950/30'
                    : 'border-slate-800/90 bg-[#111827]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      bottomColor === 'b'
                        ? 'border-amber-400/40 bg-[#EAE6DF]'
                        : 'border-slate-700 bg-slate-800/90'
                    }`}
                  >
                    <div className="h-6 w-6">
                      <ChessPieceSVG
                        type="k"
                        color={bottomColor}
                        style={preferences.pieceStyle}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs sm:text-sm font-bold text-white">
                        {getPlayerLabel(bottomColor)}
                      </span>
                      <span className="hidden sm:inline-block shrink-0 whitespace-nowrap rounded bg-slate-800/90 px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-slate-300">
                        {getPlayerRatingBadge(bottomColor)}
                      </span>
                      {materialSummary.advantageColor === bottomColor && (
                        <span className="shrink-0 whitespace-nowrap rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-mono-tabular font-bold text-emerald-400">
                          +{Math.abs(materialSummary.advantage)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 min-h-[18px] mt-0.5">
                      {(bottomColor === 'w'
                        ? materialSummary.capturedByWhite
                        : materialSummary.capturedByBlack
                      ).map((pieceType, idx) => (
                        <div
                          key={idx}
                          className={`h-4 w-4 rounded-sm p-0.5 ${
                            bottomColor === 'w' ? 'bg-[#EAE6DF]/85' : ''
                          }`}
                        >
                          <ChessPieceSVG
                            type={pieceType}
                            color={bottomColor === 'w' ? 'b' : 'w'}
                            style={preferences.pieceStyle}
                          />
                        </div>
                      ))}
                      {(bottomColor === 'w'
                        ? materialSummary.capturedByWhite
                        : materialSummary.capturedByBlack
                      ).length === 0 && (
                        <span className="text-[11px] text-slate-400">
                          No captures yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {timeControl !== 'unlimited' ? (
                  <div
                    data-testid={`clock-display-${bottomColor}`}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono-tabular text-sm sm:text-base font-bold ${
                      currentTurn === bottomColor && !gameOverDetails
                        ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {formatClock(
                        bottomColor === 'w' ? whiteTime : blackTime
                      )}
                    </span>
                  </div>
                ) : (
                  <div
                    data-testid={`clock-display-${bottomColor}`}
                    className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-slate-400"
                  >
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span>∞</span>
                  </div>
                )}
              </div>

              {/* Mobile Compact Tab Bar (Below board on <lg viewports) */}
              <div
                data-testid="mobile-tab-bar"
                className="mt-3 grid w-full max-w-[min(72vh,640px)] grid-cols-3 gap-1.5 rounded-xl border border-slate-800 bg-[#111827] p-1 lg:hidden"
              >
                <button
                  type="button"
                  data-testid="mobile-tab-moves"
                  onClick={() => setMobilePanelTab('moves')}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    mobilePanelTab === 'moves'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Moves ({movePairs.length})
                </button>
                <button
                  type="button"
                  data-testid="mobile-tab-insight"
                  onClick={() => setMobilePanelTab('insight')}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    mobilePanelTab === 'insight'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Coach & Hints
                </button>
                <button
                  type="button"
                  data-testid="mobile-tab-setup"
                  onClick={() => setMobilePanelTab('setup')}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    mobilePanelTab === 'setup'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Match & Clocks
                </button>
              </div>
            </div>

            {/* RIGHT AREA: Unified Professional Command Panel */}
            <aside className="flex w-full max-w-[min(72vh,640px)] mx-auto lg:mx-0 lg:w-[310px] xl:w-[390px] shrink-0 flex-col gap-3">
              {/* 1. Live Game Status, Evaluation & Material Balance Banner (Always visible on desktop, visible on Moves/Insight tab on mobile) */}
              <div
                className={`rounded-xl border border-slate-800/90 bg-[#121A2A] p-3.5 ${
                  mobilePanelTab === 'setup' ? 'hidden lg:block' : 'block'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        gameOverDetails
                          ? 'bg-amber-400'
                          : inCheck
                          ? 'bg-rose-500 animate-ping'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-white">
                      {gameOverDetails
                        ? gameOverDetails.title
                        : isAIThinking
                        ? 'AI Calculating Best Move...'
                        : inCheck
                        ? `${
                            currentTurn === 'w' ? 'White' : 'Black'
                          } is in Check!`
                        : `${
                            currentTurn === 'w' ? 'White' : 'Black'
                          } to Move`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-tabular text-xs">
                    <span
                      data-testid="eval-score-badge"
                      className="rounded border border-slate-700 bg-[#0B101B] px-2 py-0.5 font-semibold text-slate-200"
                    >
                      Eval: {evalFormatted}
                    </span>
                    <span
                      data-testid="material-balance-badge"
                      className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-300"
                    >
                      {materialAdvantageLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Match Setup, AI Strength & Chess Clock Presets (Desktop always, Mobile 'setup' tab) */}
              <div
                className={`rounded-xl border border-slate-800/90 bg-[#121A2A] p-3.5 space-y-2.5 ${
                  mobilePanelTab === 'setup' ? 'block' : 'hidden lg:block'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Match Mode & AI Difficulty
                  </span>
                  <span className="text-[11px] font-mono-tabular text-emerald-400">
                    {gameMode === 'ai'
                      ? `AI: ${difficulty.toUpperCase()}`
                      : gameMode === 'two-player'
                      ? '2P Local'
                      : 'Free Practice'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#0B101B] p-1">
                  {(
                    [
                      { id: 'ai', label: 'Play Computer' },
                      { id: 'two-player', label: 'Two Player' },
                      { id: 'practice', label: 'Practice' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`switch-mode-${m.id}`}
                      onClick={() => {
                        if (m.id !== gameMode) {
                          startNewGame(m.id);
                        }
                      }}
                      className={`rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        gameMode === m.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {gameMode === 'ai' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 mr-1">
                        Level:
                      </span>
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          data-testid={`in-game-diff-${d}`}
                          onClick={() => setDifficulty(d)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                            difficulty === d
                              ? 'bg-amber-500/20 border border-amber-400/60 text-amber-200'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 mr-1">
                        Side:
                      </span>
                      {(
                        [
                          { id: 'w', label: 'W' },
                          { id: 'random', label: '?' },
                          { id: 'b', label: 'B' },
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setPlayerColorChoice(s.id);
                            const nextColor: Color =
                              s.id === 'random'
                                ? Math.random() < 0.5
                                  ? 'w'
                                  : 'b'
                                : s.id;
                            setHumanColor(nextColor);
                            setBoardOrientation(nextColor);
                          }}
                          className={`rounded px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                            playerColorChoice === s.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Chess Clock Presets */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-emerald-400" />
                      <span>Chess Clock Preset</span>
                    </span>
                    <span className="font-mono-tabular text-slate-300">
                      {TIME_CONTROLS[timeControl].description}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      ['bullet', 'blitz', 'rapid', 'unlimited'] as TimeControl[]
                    ).map((tc) => (
                      <button
                        key={tc}
                        type="button"
                        data-testid={`ingame-clock-${tc}`}
                        onClick={() => handleSelectTimeControlPreset(tc)}
                        className={`rounded-md py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                          timeControl === tc
                            ? 'bg-emerald-600/25 border border-emerald-500/60 text-emerald-200'
                            : 'border border-slate-800 bg-[#0B101B] text-slate-400 hover:text-white'
                        }`}
                      >
                        {TIME_CONTROLS[tc].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Position Insight & Evaluated Move Hints (Desktop always, Mobile 'insight' tab) */}
              <div
                className={`rounded-xl border border-slate-800/90 bg-[#121A2A] p-3.5 space-y-2 ${
                  mobilePanelTab === 'insight' ? 'block' : 'hidden lg:block'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Position & Move Insight
                  </span>
                  <div className="flex items-center gap-1.5">
                    {gameMode === 'practice' && (
                      <button
                        type="button"
                        data-testid="restart-practice-btn"
                        onClick={() => startNewGame('practice')}
                        className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3 text-emerald-400" />
                        <span>Reset</span>
                      </button>
                    )}
                    {(gameMode === 'practice' || gameMode === 'ai') && (
                      <button
                        type="button"
                        data-testid="hint-btn"
                        onClick={handleShowHint}
                        disabled={isAIThinking || Boolean(gameOverDetails)}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                        <span>Legal Move Hint</span>
                      </button>
                    )}
                  </div>
                </div>

                {moveFeedback ? (
                  <div className="rounded-lg border border-slate-800 bg-[#0D1320] p-2.5 text-xs">
                    <div className="font-semibold text-emerald-300">
                      {moveFeedback.headline}
                    </div>
                    <p className="mt-0.5 text-slate-300 leading-relaxed">
                      {moveFeedback.explanation}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-[#0D1320] p-2.5 text-xs text-slate-400">
                    Click or drag any {currentTurn === 'w' ? 'White' : 'Black'}{' '}
                    piece to highlight legal moves and view tactical feedback.
                  </div>
                )}

                {hintMove && (
                  <div
                    data-testid="hint-explanation-box"
                    className="rounded-lg border border-amber-400/40 bg-amber-950/30 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-amber-300">
                      <span>
                        Suggested Move: {hintMove.san} ({hintMove.from} →{' '}
                        {hintMove.to})
                      </span>
                      <span className="font-mono-tabular">
                        Eval {hintMove.evaluationPawns}
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-200">{hintMove.reason}</p>
                  </div>
                )}

                {gameMode === 'practice' && (
                  <div className="truncate font-mono-tabular text-[10px] text-slate-400">
                    FEN: {fen}
                  </div>
                )}
              </div>

              {/* 4. Scrollable Algebraic Move History (Desktop always, Mobile 'moves' tab) */}
              <div
                className={`flex flex-col rounded-xl border border-slate-800/90 bg-[#121A2A] p-3.5 ${
                  mobilePanelTab === 'moves' ? 'flex' : 'hidden lg:flex'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-white">
                    Move History (Algebraic Notation)
                  </h2>
                  <span className="text-xs font-mono-tabular text-slate-400">
                    {movePairs.length}{' '}
                    {movePairs.length === 1 ? 'turn' : 'turns'}
                  </span>
                </div>

                <div
                  data-testid="move-history-list"
                  className="h-44 sm:h-48 overflow-y-auto rounded-lg border border-slate-800/90 bg-[#0B101B] p-2 chess-scroll"
                >
                  {movePairs.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-500">
                      <AlertCircle className="mb-1.5 h-4 w-4 text-slate-600" />
                      <span>No moves played yet.</span>
                      <span className="text-[11px]">
                        1. e4 e5 2. Nf3 Nc6 will appear here.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1 font-mono-tabular text-xs">
                      {movePairs.map((pair, idx) => {
                        const isLatestRow = idx === movePairs.length - 1;
                        return (
                          <div
                            key={pair.moveNumber}
                            className={`grid grid-cols-7 items-center rounded px-2 py-1 ${
                              isLatestRow
                                ? 'bg-emerald-950/40 border border-emerald-500/30'
                                : 'odd:bg-slate-900/50'
                            }`}
                          >
                            <span className="col-span-1 text-slate-500">
                              {pair.moveNumber}.
                            </span>
                            <span
                              className={`col-span-3 font-medium ${
                                isLatestRow && !pair.black
                                  ? 'text-emerald-300 font-bold'
                                  : 'text-slate-100'
                              }`}
                            >
                              {pair.white?.san || ''}
                            </span>
                            <span
                              className={`col-span-3 font-medium ${
                                isLatestRow && pair.black
                                  ? 'text-emerald-300 font-bold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {pair.black?.san || ''}
                            </span>
                          </div>
                        );
                      })}
                      <div ref={moveListEndRef} />
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Primary Game Controls Dock (Always visible) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="undo-move-btn"
                  onClick={handleUndoMove}
                  disabled={moveHistory.length === 0 || isAIThinking}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-2.5 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Undo2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Undo Move</span>
                </button>

                <button
                  type="button"
                  data-testid="flip-board-btn"
                  onClick={() =>
                    setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'))
                  }
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-2.5 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FlipVertical2 className="h-3.5 w-3.5 text-amber-400" />
                  <span>Flip Board</span>
                </button>

                <button
                  type="button"
                  data-testid="new-game-btn"
                  onClick={handleRequestRestart}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-2.5 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                  <span>New Game</span>
                </button>

                <button
                  type="button"
                  data-testid="offer-draw-btn"
                  onClick={handleOfferDraw}
                  disabled={Boolean(gameOverDetails) || isAIThinking}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-2.5 py-2.5 text-xs font-semibold text-slate-200 hover:border-amber-400/50 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Handshake className="h-3.5 w-3.5 text-amber-400" />
                  <span>Offer Draw</span>
                </button>

                <button
                  type="button"
                  data-testid="resign-btn"
                  onClick={handleRequestResign}
                  disabled={Boolean(gameOverDetails) || isAIThinking}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-2.5 py-2.5 text-xs font-semibold text-rose-300 hover:border-rose-500/60 hover:bg-rose-950/30 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Flag className="h-3.5 w-3.5 text-rose-400" />
                  <span>Resign</span>
                </button>

                <button
                  type="button"
                  data-testid="dock-sound-btn"
                  onClick={() =>
                    updatePreferences({
                      soundEnabled: !preferences.soundEnabled,
                    })
                  }
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-2.5 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  {preferences.soundEnabled ? (
                    <>
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Sound On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                      <span>Muted</span>
                    </>
                  )}
                </button>
              </div>
            </aside>
          </main>
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
      />

      {isGameOverModalOpen && (
        <GameOverModal
          details={gameOverDetails}
          onPlayAgain={() => startNewGame()}
          onReturnHome={() => {
            setIsGameOverModalOpen(false);
            handleNavigate('home');
          }}
          onDismiss={() => setIsGameOverModalOpen(false)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmVariant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
