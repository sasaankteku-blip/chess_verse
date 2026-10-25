import React, { useState } from 'react';
import { Chess, Color, Move, PieceSymbol, Square } from 'chess.js';
import { BoardTheme, EvaluatedHint, PieceStyle } from '../game/engine';
import { ChessPieceSVG } from './ChessPieces';

export interface BoardThemeColors {
  name: string;
  lightSquare: string;
  darkSquare: string;
  lightCoord: string;
  darkCoord: string;
  selectedSquare: string;
  lastMoveLight: string;
  lastMoveDark: string;
  borderClass: string;
}

export const BOARD_THEMES: Record<BoardTheme, BoardThemeColors> = {
  emerald: {
    name: 'Emerald Tournament',
    lightSquare: '#EAE6DF',
    darkSquare: '#2E6F54',
    lightCoord: '#2E6F54',
    darkCoord: '#EAE6DF',
    selectedSquare: 'rgba(212, 175, 55, 0.62)',
    lastMoveLight: '#DCE5B5',
    lastMoveDark: '#478C63',
    borderClass: 'border-[#1E2E2A] bg-[#111B18]',
  },
  walnut: {
    name: 'Royal Walnut',
    lightSquare: '#F0E4D0',
    darkSquare: '#7C5338',
    lightCoord: '#7C5338',
    darkCoord: '#F0E4D0',
    selectedSquare: 'rgba(234, 179, 8, 0.58)',
    lastMoveLight: '#E5D399',
    lastMoveDark: '#996D3D',
    borderClass: 'border-[#3A2618] bg-[#22160E]',
  },
  slate: {
    name: 'Midnight Slate',
    lightSquare: '#DCE3EC',
    darkSquare: '#435670',
    lightCoord: '#435670',
    darkCoord: '#DCE3EC',
    selectedSquare: 'rgba(52, 211, 153, 0.52)',
    lastMoveLight: '#BFE0D8',
    lastMoveDark: '#3B7278',
    borderClass: 'border-[#253246] bg-[#131B26]',
  },
};

interface ChessboardProps {
  chess: Chess;
  boardOrientation: Color;
  selectedSquare: Square | null;
  legalMovesForSelected: Move[];
  lastMove: { from: Square; to: Square } | null;
  hintMove: EvaluatedHint | null;
  onSquareClick: (square: Square) => void;
  onMovePiece: (from: Square, to: Square, promotion?: PieceSymbol) => boolean;
  theme: BoardTheme;
  pieceStyle: PieceStyle;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  enableAnimations: boolean;
  disabled?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const Chessboard: React.FC<ChessboardProps> = ({
  chess,
  boardOrientation,
  selectedSquare,
  legalMovesForSelected,
  lastMove,
  hintMove,
  onSquareClick,
  onMovePiece,
  theme,
  pieceStyle,
  showCoordinates,
  showLegalMoves,
  enableAnimations,
  disabled = false,
}) => {
  const [draggedFrom, setDraggedFrom] = useState<Square | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
    color: Color;
  } | null>(null);

  const themeColors = BOARD_THEMES[theme];
  const board = chess.board();
  const inCheck = chess.inCheck();
  const turn = chess.turn();

  const displayRanks = boardOrientation === 'w' ? RANKS : [...RANKS].reverse();
  const displayFiles = boardOrientation === 'w' ? FILES : [...FILES].reverse();

  // Check if a move from -> to is a legal promotion move
  const isPromotionMove = (from: Square, to: Square): boolean => {
    const piece = chess.get(from);
    if (!piece || piece.type !== 'p') return false;
    const targetRank = to[1];
    if ((piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1')) {
      const moves = chess.moves({ square: from, verbose: true });
      return moves.some((m) => m.to === to && Boolean(m.promotion));
    }
    return false;
  };

  const handleSquareInteraction = (sq: Square) => {
    if (disabled || pendingPromotion) return;

    if (selectedSquare && selectedSquare !== sq) {
      const isLegalDest = legalMovesForSelected.some((m) => m.to === sq);
      if (isLegalDest) {
        if (isPromotionMove(selectedSquare, sq)) {
          setPendingPromotion({ from: selectedSquare, to: sq, color: turn });
          return;
        }
        onMovePiece(selectedSquare, sq);
        return;
      }
    }
    onSquareClick(sq);
  };

  const handleDragStart = (e: React.DragEvent, sq: Square) => {
    if (disabled || pendingPromotion) {
      e.preventDefault();
      return;
    }
    const piece = chess.get(sq);
    if (!piece || piece.color !== turn) {
      e.preventDefault();
      return;
    }
    setDraggedFrom(sq);
    e.dataTransfer.setData('text/plain', sq);
    if (selectedSquare !== sq) {
      onSquareClick(sq);
    }
  };

  const handleDragOver = (e: React.DragEvent, sq: Square) => {
    e.preventDefault();
    if (dragOverSquare !== sq) {
      setDragOverSquare(sq);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSquare: Square) => {
    e.preventDefault();
    setDragOverSquare(null);
    const fromSquare = (draggedFrom || e.dataTransfer.getData('text/plain')) as Square;
    setDraggedFrom(null);

    if (!fromSquare || fromSquare === targetSquare || disabled) return;

    const moves = chess.moves({ square: fromSquare, verbose: true });
    const isLegal = moves.some((m) => m.to === targetSquare);
    if (!isLegal) return;

    if (isPromotionMove(fromSquare, targetSquare)) {
      setPendingPromotion({ from: fromSquare, to: targetSquare, color: turn });
      return;
    }

    onMovePiece(fromSquare, targetSquare);
  };

  const completePromotion = (promoPiece: PieceSymbol) => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    onMovePiece(from, to, promoPiece);
  };

  return (
    <div
      className={`relative aspect-square w-full max-w-[min(74vh,640px)] select-none rounded-xl border-4 p-1.5 sm:p-2.5 shadow-2xl ${themeColors.borderClass}`}
      data-testid="chessboard-container"
    >
      <div
        className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-lg shadow-inner"
        role="grid"
        aria-label="Chessboard"
      >
        {displayRanks.map((rankStr, rIdx) =>
          displayFiles.map((fileStr, fIdx) => {
            const squareName = `${fileStr}${rankStr}` as Square;
            const boardRow = 8 - parseInt(rankStr, 10);
            const boardCol = FILES.indexOf(fileStr);
            const piece = board[boardRow][boardCol];

            const isLight = (boardRow + boardCol) % 2 === 0;
            const isSelected = selectedSquare === squareName;
            const isLastMove =
              lastMove?.from === squareName || lastMove?.to === squareName;
            const isHintSquare =
              hintMove?.from === squareName || hintMove?.to === squareName;

            const legalMoveToHere = legalMovesForSelected.find(
              (m) => m.to === squareName
            );
            const isLegalDestination = Boolean(legalMoveToHere);
            const isCaptureDestination =
              isLegalDestination &&
              (Boolean(piece) || Boolean(legalMoveToHere?.flags.includes('e')));

            const isKingInCheck =
              inCheck &&
              piece?.type === 'k' &&
              piece?.color === turn;

            let bgColor = isLight
              ? themeColors.lightSquare
              : themeColors.darkSquare;

            if (isLastMove) {
              bgColor = isLight
                ? themeColors.lastMoveLight
                : themeColors.lastMoveDark;
            }

            const showRankCoord = showCoordinates && fIdx === 0;
            const showFileCoord = showCoordinates && rIdx === 7;
            const coordColor = isLight
              ? themeColors.lightCoord
              : themeColors.darkCoord;

            const pieceLabel = piece
              ? `${piece.color === 'w' ? 'White' : 'Black'} ${
                  piece.type === 'p'
                    ? 'Pawn'
                    : piece.type === 'n'
                    ? 'Knight'
                    : piece.type === 'b'
                    ? 'Bishop'
                    : piece.type === 'r'
                    ? 'Rook'
                    : piece.type === 'q'
                    ? 'Queen'
                    : 'King'
                }`
              : 'Empty';

            return (
              <button
                key={squareName}
                type="button"
                data-testid={`square-${squareName}`}
                aria-label={`Square ${squareName}, ${pieceLabel}${
                  isLegalDestination ? ', legal move destination' : ''
                }`}
                onClick={() => handleSquareInteraction(squareName)}
                onDragOver={(e) => handleDragOver(e, squareName)}
                onDrop={(e) => handleDrop(e, squareName)}
                style={{ backgroundColor: bgColor }}
                className={`relative flex items-center justify-center p-0.5 sm:p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:z-10 transition-colors duration-100 ${
                  isKingInCheck ? 'king-in-check' : ''
                } ${
                  dragOverSquare === squareName
                    ? 'ring-2 ring-inset ring-emerald-400'
                    : ''
                }`}
              >
                {/* Selected square overlay */}
                {isSelected && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ backgroundColor: themeColors.selectedSquare }}
                  />
                )}

                {/* Hint square highlight */}
                {isHintSquare && (
                  <div className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-amber-400/90 bg-amber-400/25 animate-pulse" />
                )}

                {/* Rank coordinate (top-left of leftmost file) */}
                {showRankCoord && (
                  <span
                    style={{ color: coordColor }}
                    className="pointer-events-none absolute left-1 top-0.5 text-[10px] sm:text-[11px] font-bold leading-none font-mono-tabular opacity-85"
                  >
                    {rankStr}
                  </span>
                )}

                {/* File coordinate (bottom-right of bottom rank) */}
                {showFileCoord && (
                  <span
                    style={{ color: coordColor }}
                    className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] sm:text-[11px] font-bold leading-none font-mono-tabular opacity-85"
                  >
                    {fileStr}
                  </span>
                )}

                {/* Legal destination indicator (dot for empty square, corner ring for capture) */}
                {showLegalMoves && isLegalDestination && !isCaptureDestination && (
                  <span
                    data-testid={`legal-dot-${squareName}`}
                    className="pointer-events-none z-10 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-slate-950/35 shadow-sm transition-transform duration-150"
                  />
                )}

                {showLegalMoves && isCaptureDestination && (
                  <span
                    data-testid={`legal-capture-${squareName}`}
                    className="pointer-events-none absolute inset-1 z-10 rounded-full border-[4px] sm:border-[5px] border-rose-600/65"
                  />
                )}

                {/* Chess Piece */}
                {piece && (
                  <div
                    draggable={!disabled && piece.color === turn}
                    onDragStart={(e) => handleDragStart(e, squareName)}
                    className={`relative z-[5] h-[84%] w-[84%] cursor-grab active:cursor-grabbing ${
                      enableAnimations && lastMove?.to === squareName
                        ? 'animate-piece-move'
                        : 'transition-transform duration-150 hover:scale-[1.04]'
                    }`}
                  >
                    <ChessPieceSVG
                      type={piece.type}
                      color={piece.color}
                      style={pieceStyle}
                    />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Pawn Promotion Modal Overlay */}
      {pendingPromotion && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-slate-950/80 p-4"
          role="dialog"
          aria-label="Choose promotion piece"
        >
          <div className="w-full max-w-xs rounded-xl border border-emerald-500/30 bg-[#121A28] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Promote Pawn on {pendingPromotion.to}
              </h3>
              <button
                type="button"
                onClick={() => setPendingPromotion(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { type: 'q', label: 'Queen' },
                  { type: 'r', label: 'Rook' },
                  { type: 'b', label: 'Bishop' },
                  { type: 'n', label: 'Knight' },
                ] as const
              ).map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => completePromotion(item.type)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/70 p-2.5 hover:border-emerald-400 hover:bg-emerald-950/50 transition-colors"
                  aria-label={`Promote to ${item.label}`}
                >
                  <div className="h-10 w-10">
                    <ChessPieceSVG
                      type={item.type}
                      color={pendingPromotion.color}
                      style={pieceStyle}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-200">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
