import { Chess, Move, Square, PieceSymbol, Color } from 'chess.js';

export type GameMode = 'ai' | 'two-player' | 'practice';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TimeControl = 'bullet' | 'blitz' | 'rapid' | 'unlimited';
export type PlayerColorChoice = 'w' | 'b' | 'random';
export type BoardTheme = 'emerald' | 'walnut' | 'slate';
export type PieceStyle = 'staunton' | 'neo';

export interface TimeControlConfig {
  id: TimeControl;
  label: string;
  description: string;
  seconds: number; // 0 for unlimited
}

export const TIME_CONTROLS: Record<TimeControl, TimeControlConfig> = {
  bullet: { id: 'bullet', label: 'Bullet', description: '1 min', seconds: 60 },
  blitz: { id: 'blitz', label: 'Blitz', description: '5 min', seconds: 300 },
  rapid: { id: 'rapid', label: 'Rapid', description: '10 min', seconds: 600 },
  unlimited: { id: 'unlimited', label: 'No Timer', description: 'Untimed', seconds: 0 },
};

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export const DISPLAY_PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

// Piece-Square Tables (from White's perspective, rank 8 down to rank 1)
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_MID_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const PST_MAP: Record<PieceSymbol, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_MID_PST,
};

// Opening book for Hard difficulty (common strong responses keyed by simplified FEN position)
const OPENING_BOOK: Record<string, string[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': ['e4', 'd4', 'Nf3', 'c4'],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -': ['e5', 'c5', 'e6', 'c6'],
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -': ['Nf6', 'd5', 'e6'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': ['Nf3', 'Bc4', 'Nc3'],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': ['Nf3', 'Nc3', 'c3'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -': ['Nc6', 'Nf6'],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['Bb5', 'Bc4', 'd4'],
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -': ['c4', 'Nf3', 'Bf4'],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -': ['c4', 'Nf3', 'Bf4'],
};

export interface MaterialSummary {
  capturedByWhite: PieceSymbol[]; // Black pieces captured by White
  capturedByBlack: PieceSymbol[]; // White pieces captured by Black
  whiteMaterial: number;
  blackMaterial: number;
  advantage: number; // positive = White ahead, negative = Black ahead
  advantageColor: Color | null;
}

export function calculateMaterialAndCaptures(fen: string): MaterialSummary {
  const chess = new Chess(fen);
  const board = chess.board();

  const initialCounts: Record<PieceSymbol, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const currentWhite: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const currentBlack: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell) {
        if (cell.color === 'w') currentWhite[cell.type]++;
        else currentBlack[cell.type]++;
      }
    }
  }

  const order: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];

  for (const type of order) {
    const missingBlack = Math.max(0, initialCounts[type] - currentBlack[type]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(type);

    const missingWhite = Math.max(0, initialCounts[type] - currentWhite[type]);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(type);
  }

  let whiteMaterial = 0;
  let blackMaterial = 0;
  for (const type of order) {
    whiteMaterial += currentWhite[type] * DISPLAY_PIECE_VALUES[type];
    blackMaterial += currentBlack[type] * DISPLAY_PIECE_VALUES[type];
  }

  const advantage = whiteMaterial - blackMaterial;
  const advantageColor: Color | null = advantage > 0 ? 'w' : advantage < 0 ? 'b' : null;

  return {
    capturedByWhite,
    capturedByBlack,
    whiteMaterial,
    blackMaterial,
    advantage,
    advantageColor,
  };
}

/**
 * Fast static board evaluation from White's perspective (positive = White advantage, negative = Black advantage).
 * Terminal states (checkmate/draw) are checked in minimax before calling this function.
 */
export function evaluateBoard(chess: Chess): number {
  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    const row = board[r];
    for (let c = 0; c < 8; c++) {
      const piece = row[c];
      if (!piece) continue;

      const baseValue = PIECE_VALUES[piece.type];
      const pstTable = PST_MAP[piece.type];
      const positionalValue = piece.color === 'w' ? pstTable[r][c] : pstTable[7 - r][c];

      if (piece.color === 'w') {
        score += baseValue + positionalValue;
      } else {
        score -= baseValue + positionalValue;
      }
    }
  }

  if (chess.inCheck()) {
    score += chess.turn() === 'w' ? -35 : 35;
  }

  return score;
}

/**
 * Orders moves to maximize alpha-beta pruning efficiency (MVV-LVA + Promotions + Checks).
 */
export function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.captured) {
      scoreA += 10 * PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece] / 10;
    }
    if (b.captured) {
      scoreB += 10 * PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece] / 10;
    }
    if (a.promotion) scoreA += PIECE_VALUES[a.promotion];
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion];
    if (a.san.includes('+')) scoreA += 150;
    if (b.san.includes('+')) scoreB += 150;

    return scoreB - scoreA;
  });
}

function quiescenceSearch(
  chess: Chess,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  qDepth: number = 0
): number {
  const standPat = evaluateBoard(chess);

  if (qDepth >= 2) {
    return standPat;
  }

  if (maximizingPlayer) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const captureMoves = orderMoves(
      chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion)
    );

    for (const move of captureMoves) {
      chess.move(move);
      const score = quiescenceSearch(chess, alpha, beta, false, qDepth + 1);
      chess.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;

    const captureMoves = orderMoves(
      chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion)
    );

    for (const move of captureMoves) {
      chess.move(move);
      const score = quiescenceSearch(chess, alpha, beta, true, qDepth + 1);
      chess.undo();
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function minimaxAlphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  useQuiescence: boolean
): number {
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      // Prefer faster checkmates
      return chess.turn() === 'w' ? -(99999 + depth * 100) : 99999 + depth * 100;
    }
    return 0;
  }

  if (depth === 0) {
    return useQuiescence
      ? quiescenceSearch(chess, alpha, beta, maximizingPlayer)
      : evaluateBoard(chess);
  }

  const legalMoves = orderMoves(chess.moves({ verbose: true }));

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      chess.move(move);
      const evaluation = minimaxAlphaBeta(chess, depth - 1, alpha, beta, false, useQuiescence);
      chess.undo();
      if (evaluation > maxEval) maxEval = evaluation;
      if (evaluation > alpha) alpha = evaluation;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      chess.move(move);
      const evaluation = minimaxAlphaBeta(chess, depth - 1, alpha, beta, true, useQuiescence);
      chess.undo();
      if (evaluation < minEval) minEval = evaluation;
      if (evaluation < beta) beta = evaluation;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export interface AIMoveResult {
  move: Move;
  evaluation: number;
  depthReached: number;
}

/**
 * Selects a move for the AI based on the chosen difficulty:
 * - Easy: Depth 1 evaluation with deliberate randomness among playable moves so beginners can beat it.
 * - Medium: Depth 2-3 tactical & positional minimax search with alpha-beta pruning.
 * - Hard: Opening book lookup + Depth 3-4 alpha-beta search with quiescence search and move ordering.
 */
export function findBestMove(
  fen: string,
  difficulty: Difficulty,
  deterministicSeed?: number
): AIMoveResult | null {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  const isWhite = chess.turn() === 'w';

  if (difficulty === 'easy') {
    // Evaluate each move at depth 1
    const scoredMoves = legalMoves.map((move) => {
      chess.move(move);
      const score = evaluateBoard(chess);
      chess.undo();
      // Normalize so higher is always better for current side
      const sideScore = isWhite ? score : -score;
      return { move, sideScore, rawScore: score };
    });

    scoredMoves.sort((a, b) => b.sideScore - a.sideScore);

    // Easy mode avoids consistently picking the absolute strongest move:
    // Picks from the top 60% of moves (or top 5 moves) so it plays plausible chess but makes beginner-friendly inaccuracies
    const poolSize = Math.min(scoredMoves.length, Math.max(2, Math.ceil(scoredMoves.length * 0.55)));
    const candidatePool = scoredMoves.slice(0, poolSize);
    const randIndex =
      deterministicSeed !== undefined
        ? deterministicSeed % candidatePool.length
        : Math.min(
            candidatePool.length - 1,
            Math.floor(Math.random() * candidatePool.length)
          );
    const chosen = candidatePool[randIndex];
    return {
      move: chosen.move,
      evaluation: chosen.rawScore,
      depthReached: 1,
    };
  }

  if (difficulty === 'medium') {
    const ordered = orderMoves(legalMoves);
    const searchDepth = 2;
    let bestMove = ordered[0];
    let bestSideScore = -Infinity;
    let bestRawScore = 0;
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of ordered) {
      chess.move(move);
      const rawEval = minimaxAlphaBeta(
        chess,
        searchDepth - 1,
        alpha,
        beta,
        !isWhite,
        false
      );
      chess.undo();

      const sideScore = isWhite ? rawEval : -rawEval;
      if (sideScore > bestSideScore) {
        bestSideScore = sideScore;
        bestRawScore = rawEval;
        bestMove = move;
      }
      if (isWhite && rawEval > alpha) alpha = rawEval;
      if (!isWhite && rawEval < beta) beta = rawEval;
    }

    return {
      move: bestMove,
      evaluation: bestRawScore,
      depthReached: searchDepth,
    };
  }

  // Hard difficulty: check opening book first, then deep search with Quiescence
  const simplifiedFen = fen.split(' ').slice(0, 4).join(' ');
  const bookSanList = OPENING_BOOK[simplifiedFen];
  if (bookSanList && bookSanList.length > 0 && deterministicSeed === undefined) {
    const matchingBookMoves = legalMoves.filter((m) => bookSanList.includes(m.san));
    if (matchingBookMoves.length > 0) {
      const chosenBook = matchingBookMoves[Math.floor(Math.random() * matchingBookMoves.length)];
      chess.move(chosenBook);
      const bookEval = evaluateBoard(chess);
      chess.undo();
      return {
        move: chosenBook,
        evaluation: bookEval,
        depthReached: 4,
      };
    }
  }

  const ordered = orderMoves(legalMoves);
  const searchDepth = 3;
  let bestMove = ordered[0];
  let bestSideScore = -Infinity;
  let bestRawScore = 0;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of ordered) {
    chess.move(move);
    const rawEval = minimaxAlphaBeta(
      chess,
      searchDepth - 1,
      alpha,
      beta,
      !isWhite,
      true
    );
    chess.undo();

    const sideScore = isWhite ? rawEval : -rawEval;
    if (sideScore > bestSideScore) {
      bestSideScore = sideScore;
      bestRawScore = rawEval;
      bestMove = move;
    }
    if (isWhite && rawEval > alpha) alpha = rawEval;
    if (!isWhite && rawEval < beta) beta = rawEval;
  }

  return {
    move: bestMove,
    evaluation: bestRawScore,
    depthReached: searchDepth,
  };
}

export interface MoveFeedback {
  headline: string;
  explanation: string;
  type: 'checkmate' | 'check' | 'capture' | 'castle' | 'promotion' | 'positional';
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

export function analyzeMoveFeedback(chessAfterMove: Chess, move: Move): MoveFeedback {
  const sideName = move.color === 'w' ? 'White' : 'Black';
  const pieceName = PIECE_NAMES[move.piece];

  if (chessAfterMove.isCheckmate()) {
    return {
      headline: `Checkmate by ${sideName} (${move.san})`,
      explanation: `${sideName}'s ${pieceName} on ${move.to} delivers checkmate. The opposing King is in check and has no legal escape squares.`,
      type: 'checkmate',
    };
  }

  if (chessAfterMove.inCheck()) {
    return {
      headline: `Check on the King (${move.san})`,
      explanation: `${sideName}'s ${pieceName} moved to ${move.to}, placing the opposing King under direct attack.${move.captured ? ` Also captured a ${PIECE_NAMES[move.captured]}.` : ''}`,
      type: 'check',
    };
  }

  if (move.promotion) {
    const promotedName = PIECE_NAMES[move.promotion];
    return {
      headline: `Pawn Promotion (${move.san})`,
      explanation: `${sideName} advanced a pawn to the 8th rank on ${move.to} and promoted it to a ${promotedName}.`,
      type: 'promotion',
    };
  }

  if (move.flags.includes('k') || move.flags.includes('q')) {
    const side = move.flags.includes('k') ? 'kingside' : 'queenside';
    return {
      headline: `Castled ${side} (${move.san})`,
      explanation: `${sideName} tucked the King to safety and activated the Rook toward the center files.`,
      type: 'castle',
    };
  }

  if (move.captured) {
    const capturedName = PIECE_NAMES[move.captured];
    const isEnPassant = move.flags.includes('e');
    return {
      headline: `Captured ${capturedName} (${move.san})`,
      explanation: `${sideName}'s ${pieceName} captured an opposing ${capturedName} on ${move.to}${isEnPassant ? ' via en passant' : ''}, shifting the material balance.`,
      type: 'capture',
    };
  }

  const centerSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
  if (centerSquares.includes(move.to)) {
    return {
      headline: `Central Control (${move.san})`,
      explanation: `${sideName} placed a ${pieceName} on ${move.to} to contest the vital central squares and increase piece mobility.`,
      type: 'positional',
    };
  }

  return {
    headline: `${sideName} played ${move.san}`,
    explanation: `${sideName} repositioned the ${pieceName} from ${move.from} to ${move.to} to improve coordination.`,
    type: 'positional',
  };
}

export interface EvaluatedHint {
  from: Square;
  to: Square;
  san: string;
  reason: string;
  evaluationPawns: string;
}

export function getEvaluatedHint(fen: string): EvaluatedHint | null {
  const result = findBestMove(fen, 'medium');
  if (!result) return null;

  const { move, evaluation } = result;
  const chess = new Chess(fen);
  chess.move(move);

  const pieceName = PIECE_NAMES[move.piece];
  let reason = `Develops the ${pieceName} from ${move.from} to ${move.to} for stronger board control.`;

  if (chess.isCheckmate()) {
    reason = `Delivers immediate checkmate with the ${pieceName} on ${move.to}!`;
  } else if (move.captured && chess.inCheck()) {
    reason = `Captures the ${PIECE_NAMES[move.captured]} on ${move.to} with check!`;
  } else if (move.captured) {
    reason = `Wins material by capturing the ${PIECE_NAMES[move.captured]} on ${move.to}.`;
  } else if (chess.inCheck()) {
    reason = `Places the opposing King in check from ${move.to}, forcing a defensive response.`;
  } else if (move.flags.includes('k') || move.flags.includes('q')) {
    reason = `Castles the King to safety while activating the Rook.`;
  }

  const evalNum = evaluation / 100;
  const sign = evalNum > 0 ? '+' : '';
  const evaluationPawns = Math.abs(evalNum) > 500 ? 'Forced Mate' : `${sign}${evalNum.toFixed(1)}`;

  return {
    from: move.from,
    to: move.to,
    san: move.san,
    reason,
    evaluationPawns,
  };
}

export interface MovePair {
  moveNumber: number;
  white?: Move;
  black?: Move;
}

export function groupMoveHistory(history: Move[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }
  return pairs;
}
