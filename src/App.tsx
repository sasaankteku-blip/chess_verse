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
} from 'lucide-react';
import {
  analyzeMoveFeedback,
  calculateMaterialAndCaptures,
  Difficulty,
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
import {
  loadPreferences,
  savePreferences,
  UserPreferences,
} from './utils/preferences';
import { soundFX } from './utils/sound';

type AppView = 'title' | 'playing';

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

  // Check ?autostart=1 for instant gameplay launch
  const [view, setView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
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

  // Clocks (in seconds)
  const [whiteTime, setWhiteTime] = useState<number>(
    TIME_CONTROLS[timeControl].seconds
  );
  const [blackTime, setBlackTime] = useState<number>(
    TIME_CONTROLS[timeControl].seconds
  );

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
    moveListEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        soundFX.playGameOver(
          gameMode !== 'ai' || winnerColor === humanColor
        );
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
      } else if (chessInstance.isThreefoldRepetition()) {
        details = {
          title: 'Draw by Repetition',
          subtitle: 'Threefold Repetition Rule',
          winner: 'draw',
          reason:
            'The exact same board position has been repeated three times.',
          totalMoves: movesCount,
          materialAdvantage: matText,
        };
        soundFX.playGameOver(false);
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
      }

      setGameOverDetails(details);
      setIsGameOverModalOpen(true);
      setIsAIThinking(false);
      return true;
    },
    [gameMode, humanColor]
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
        const moveObj = chessRef.current.move({
          from,
          to,
          promotion: promotion || 'q',
        });
        if (moveObj) {
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
          } else if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) {
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
        const handleMessage = (event: MessageEvent<AIWorkerResponse & { error?: boolean }>) => {
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
    }, 260);

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

  // Chess Clocks Countdown
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

    const interval = setInterval(() => {
      const activeTurn = chessRef.current.turn();
      if (activeTurn === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            soundFX.playGameOver(false);
            setGameOverDetails({
              title: 'Time Out!',
              subtitle: 'Black Wins on Time',
              winner: 'b',
              reason: "White's chess clock expired before completing the game.",
              totalMoves: Math.ceil(chessRef.current.history().length / 2),
              materialAdvantage: materialAdvantageLabel,
            });
            setIsGameOverModalOpen(true);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            soundFX.playGameOver(true);
            setGameOverDetails({
              title: 'Time Out!',
              subtitle: 'White Wins on Time',
              winner: 'w',
              reason: "Black's chess clock expired before completing the game.",
              totalMoves: Math.ceil(chessRef.current.history().length / 2),
              materialAdvantage: materialAdvantageLabel,
            });
            setIsGameOverModalOpen(true);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    view,
    timeControl,
    gameOverDetails,
    isSettingsOpen,
    confirmDialog?.isOpen,
    materialAdvantageLabel,
  ]);

  const startNewGame = useCallback(
    (overrideMode?: GameMode) => {
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
      setWhiteTime(initialSeconds);
      setBlackTime(initialSeconds);

      setView('playing');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [gameMode, playerColorChoice, timeControl]
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

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        updatePreferences({ soundEnabled: !preferences.soundEnabled });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isSettingsOpen, startNewGame, preferences.soundEnabled, updatePreferences]);

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
      const moveResult = chessRef.current.move({
        from,
        to,
        promotion,
      });
      if (!moveResult) return false;

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

    if (gameMode === 'ai') {
      // Undo both AI response and human's last move so it returns to human's turn
      if (chessRef.current.turn() === humanColor && moveHistory.length >= 2) {
        chessRef.current.undo();
        chessRef.current.undo();
      } else {
        chessRef.current.undo();
      }
    } else {
      chessRef.current.undo();
    }

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
      gameMode === 'ai'
        ? humanColor
        : chessRef.current.turn();
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
      // Evaluate whether AI accepts draw (accepts if human is equal or ahead after at least 6 moves)
      const evalScore =
        humanColor === 'w'
          ? materialSummary.advantage
          : -materialSummary.advantage;
      const canAccept = moveHistory.length >= 8 && evalScore >= -1;

      if (canAccept) {
        soundFX.playGameOver(false);
        setGameOverDetails({
          title: 'Draw by Agreement',
          subtitle: 'AI Accepted Your Draw Offer (½ – ½)',
          winner: 'draw',
          reason:
            'Both sides agreed to a draw in a balanced position.',
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

    // Two-player or Practice mutual draw confirmation
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
        setGameOverDetails({
          title: 'Draw by Mutual Agreement',
          subtitle: 'Match Drawn (½ – ½)',
          winner: 'draw',
          reason: 'Both players mutually agreed to conclude the match in a draw.',
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

  const legalMovesForSelected = selectedSquare
    ? chessRef.current.moves({ square: selectedSquare, verbose: true })
    : [];

  const currentTurn = chessRef.current.turn();
  const inCheck = chessRef.current.inCheck();
  const movePairs = groupMoveHistory(moveHistory);

  // Determine Top Player and Bottom Player labels based on boardOrientation
  const topColor: Color = boardOrientation === 'w' ? 'b' : 'w';
  const bottomColor: Color = boardOrientation;

  const getPlayerLabel = (color: Color): string => {
    const colorName = color === 'w' ? 'White' : 'Black';
    if (gameMode === 'two-player') {
      return color === 'w' ? 'Player 1 — White' : 'Player 2 — Black';
    }
    if (gameMode === 'practice') {
      return `Practice — ${colorName}`;
    }
    if (color === humanColor) {
      return `You — ${colorName}`;
    }
    return `ChessVerse AI (${difficulty.toUpperCase()}) — ${colorName}`;
  };

  if (view === 'title') {
    return (
      <>
        <HomeScreen
          selectedMode={gameMode}
          onSelectMode={setGameMode}
          selectedDifficulty={difficulty}
          onSelectDifficulty={setDifficulty}
          selectedColor={playerColorChoice}
          onSelectColor={setPlayerColorChoice}
          selectedTimeControl={timeControl}
          onSelectTimeControl={setTimeControl}
          onStartGame={startNewGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          soundEnabled={preferences.soundEnabled}
          onToggleSound={() =>
            updatePreferences({ soundEnabled: !preferences.soundEnabled })
          }
          pieceStyle={preferences.pieceStyle}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0B101B] text-[#F4F2ED] flex flex-col">
      {/* Compact Game Shell Header */}
      <header className="border-b border-slate-800/80 bg-[#0F1624] px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView('title')}
              data-testid="return-home-btn"
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#151F32] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap"
            >
              <Home className="h-3.5 w-3.5 text-emerald-400" />
              <span>Return to Home</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="font-bold text-white">ChessVerse</span>
              <span>·</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                {gameMode === 'ai' && <Bot className="h-3.5 w-3.5" />}
                {gameMode === 'two-player' && <Users className="h-3.5 w-3.5" />}
                {gameMode === 'practice' && (
                  <GraduationCap className="h-3.5 w-3.5" />
                )}
                {gameMode === 'ai'
                  ? `Play vs AI (${difficulty.toUpperCase()})`
                  : gameMode === 'two-player'
                  ? 'Two Player Mode'
                  : 'Practice Mode'}
              </span>
            </div>
          </div>

          {/* Live Turn & Check Status Indicator */}
          <div
            data-testid="turn-status-banner"
            className="flex items-center gap-2.5 text-xs font-semibold"
          >
            {isAIThinking ? (
              <span className="flex items-center gap-1.5 text-amber-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>AI Engine Thinking...</span>
              </span>
            ) : gameOverDetails ? (
              <span className="text-amber-400">{gameOverDetails.title}</span>
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

          {/* Right Utility Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updatePreferences({ soundEnabled: !preferences.soundEnabled })
              }
              aria-label={
                preferences.soundEnabled ? 'Sound On (Click to Mute)' : 'Sound Off (Click to Unmute)'
              }
              data-testid="sound-toggle-btn"
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#151F32] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/50 transition-colors whitespace-nowrap"
            >
              {preferences.soundEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Sound On</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                  <span className="hidden md:inline">Sound Off</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open Settings"
              data-testid="open-settings-btn"
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#151F32] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/50 transition-colors whitespace-nowrap"
            >
              <Settings className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden md:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Arena Layout */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-3 py-4 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:py-6">
        {/* Left / Center Column: Top Player Bar + 8x8 Chessboard + Bottom Player Bar */}
        <div className="flex flex-1 flex-col items-center justify-center w-full">
          {/* Top Player HUD Strip */}
          <div
            data-testid="top-player-bar"
            className={`mb-2.5 flex w-full max-w-[min(74vh,640px)] items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors ${
              currentTurn === topColor && !gameOverDetails
                ? 'border-emerald-500/70 bg-[#132232]'
                : 'border-slate-800/90 bg-[#111827]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
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
                  {materialSummary.advantageColor === topColor && (
                    <span className="text-xs font-mono-tabular font-bold text-emerald-400">
                      +{Math.abs(materialSummary.advantage)}
                    </span>
                  )}
                </div>
                {/* Captured Pieces by Top Player */}
                <div className="flex items-center gap-0.5 min-h-[18px]">
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

            {/* Top Player Clock */}
            {timeControl !== 'unlimited' && (
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
            )}
          </div>

          {/* 8x8 Interactive Chessboard */}
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

          {/* Bottom Player HUD Strip */}
          <div
            data-testid="bottom-player-bar"
            className={`mt-2.5 flex w-full max-w-[min(74vh,640px)] items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors ${
              currentTurn === bottomColor && !gameOverDetails
                ? 'border-emerald-500/70 bg-[#132232]'
                : 'border-slate-800/90 bg-[#111827]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
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
                  {materialSummary.advantageColor === bottomColor && (
                    <span className="text-xs font-mono-tabular font-bold text-emerald-400">
                      +{Math.abs(materialSummary.advantage)}
                    </span>
                  )}
                </div>
                {/* Captured Pieces by Bottom Player */}
                <div className="flex items-center gap-0.5 min-h-[18px]">
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

            {/* Bottom Player Clock */}
            {timeControl !== 'unlimited' && (
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
                  {formatClock(bottomColor === 'w' ? whiteTime : blackTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Command Panel, Mode Switcher, Move Feedback, Move History & Action Dock */}
        <aside className="flex w-full lg:w-[370px] xl:w-[400px] shrink-0 flex-col gap-3.5">
          {/* Quick Mode & Difficulty Switcher Card */}
          <div className="rounded-xl border border-slate-800/90 bg-[#121A2A] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Active Mode
              </span>
              <span className="text-xs font-mono-tabular text-amber-300">
                Material: {materialAdvantageLabel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#0B101B] p-1">
              {(
                [
                  { id: 'ai', label: 'vs AI' },
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
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
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
              <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">AI Strength:</span>
                <div className="flex items-center gap-1">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      data-testid={`in-game-diff-${d}`}
                      onClick={() => setDifficulty(d)}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                        difficulty === d
                          ? 'bg-amber-500/20 border border-amber-400/60 text-amber-200'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Practice Mode & Tactical Move Feedback Panel */}
          <div className="rounded-xl border border-slate-800/90 bg-[#121A2A] p-3.5 space-y-2.5">
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
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap"
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
                    className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 transition-colors whitespace-nowrap"
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
                Select or drag any {currentTurn === 'w' ? 'White' : 'Black'} piece to view legal destinations and real-time tactical commentary.
              </div>
            )}

            {hintMove && (
              <div
                data-testid="hint-explanation-box"
                className="rounded-lg border border-amber-400/40 bg-amber-950/30 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-amber-300">
                  <span>
                    Suggested Move: {hintMove.san} ({hintMove.from} → {hintMove.to})
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

          {/* Algebraic Move History Panel */}
          <div className="flex flex-col rounded-xl border border-slate-800/90 bg-[#121A2A] p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white">
                Move History (Algebraic Notation)
              </h2>
              <span className="text-xs font-mono-tabular text-slate-400">
                {movePairs.length} {movePairs.length === 1 ? 'turn' : 'turns'}
              </span>
            </div>

            <div
              data-testid="move-history-list"
              className="h-44 sm:h-52 overflow-y-auto rounded-lg border border-slate-800/90 bg-[#0B101B] p-2 chess-scroll"
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
                  {movePairs.map((pair) => (
                    <div
                      key={pair.moveNumber}
                      className="grid grid-cols-7 items-center rounded px-2 py-1 odd:bg-slate-900/50"
                    >
                      <span className="col-span-1 text-slate-500">
                        {pair.moveNumber}.
                      </span>
                      <span className="col-span-3 font-medium text-slate-100">
                        {pair.white?.san || ''}
                      </span>
                      <span className="col-span-3 font-medium text-slate-300">
                        {pair.black?.san || ''}
                      </span>
                    </div>
                  ))}
                  <div ref={moveListEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Action Controls Bar */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              data-testid="undo-move-btn"
              onClick={handleUndoMove}
              disabled={moveHistory.length === 0 || isAIThinking}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap"
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
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap"
            >
              <FlipVertical2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Flip Board</span>
            </button>

            <button
              type="button"
              data-testid="new-game-btn"
              onClick={handleRequestRestart}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
              <span>New Game</span>
            </button>

            <button
              type="button"
              data-testid="offer-draw-btn"
              onClick={handleOfferDraw}
              disabled={Boolean(gameOverDetails) || isAIThinking}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-amber-400/50 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Handshake className="h-3.5 w-3.5 text-amber-400" />
              <span>Offer Draw</span>
            </button>

            <button
              type="button"
              data-testid="resign-btn"
              onClick={handleRequestResign}
              disabled={Boolean(gameOverDetails) || isAIThinking}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-3 py-2.5 text-xs font-semibold text-rose-300 hover:border-rose-500/60 hover:bg-rose-950/30 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Flag className="h-3.5 w-3.5 text-rose-400" />
              <span>Resign</span>
            </button>

            <button
              type="button"
              onClick={() => setView('title')}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#141E30] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:text-white transition-colors whitespace-nowrap"
            >
              <Home className="h-3.5 w-3.5 text-slate-400" />
              <span>Main Menu</span>
            </button>
          </div>
        </aside>
      </main>

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
            setView('title');
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
