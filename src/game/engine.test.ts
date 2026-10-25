import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  calculateMaterialAndCaptures,
  evaluateBoard,
  findBestMove,
  analyzeMoveFeedback,
  getEvaluatedHint,
  groupMoveHistory,
  TIME_CONTROLS,
} from './engine';
import {
  validatePreferences,
  isValidRecentGameRecord,
  DEFAULT_PREFERENCES,
} from '../utils/preferences';

test('1. Standard starting position has 32 pieces, White to move, and valid clock presets', () => {
  const chess = new Chess();
  assert.equal(chess.turn(), 'w');
  const board = chess.board().flat().filter(Boolean);
  assert.equal(board.length, 32);

  const summary = calculateMaterialAndCaptures(chess.fen());
  assert.equal(summary.advantage, 0);
  assert.equal(summary.capturedByWhite.length, 0);
  assert.equal(summary.capturedByBlack.length, 0);

  // Verify clock presets match specification: Bullet 1m, Blitz 5m, Rapid 10m, Unlimited 0s
  assert.equal(TIME_CONTROLS.bullet.seconds, 60);
  assert.equal(TIME_CONTROLS.blitz.seconds, 300);
  assert.equal(TIME_CONTROLS.rapid.seconds, 600);
  assert.equal(TIME_CONTROLS.unlimited.seconds, 0);
});

test('2. Legal movement for all 6 piece types and rejection of moves exposing King to check (pins)', () => {
  // Position with Pawn, Knight, Bishop, Rook, Queen, King mobility
  const chess = new Chess(
    'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 1 5'
  );
  const legalSans = chess.moves();
  // Pawn move (a3), Knight move (Nd5), Bishop move (Bb5), Queen move (Qe2), Rook move (Rf1), King move (Ke2)
  assert.ok(legalSans.includes('a3'));
  assert.ok(legalSans.includes('Nd5'));
  assert.ok(legalSans.includes('Bb5'));
  assert.ok(legalSans.includes('Qe2'));
  assert.ok(legalSans.includes('Rf1'));
  assert.ok(legalSans.includes('Ke2'));

  // Absolute pin: White Knight on e2 is pinned to White King on e1 by Black Rook on e8
  const pinnedGame = new Chess('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1');
  const knightMoves = pinnedGame.moves({ square: 'e2' });
  assert.equal(
    knightMoves.length,
    0,
    'Pinned Knight must have zero legal moves that expose the King to check'
  );
  assert.throws(() => {
    pinnedGame.move({ from: 'e2', to: 'f4' });
  });
});

test('3. Kingside and Queenside castling plus castling restrictions (moved, blocked, in check, through check)', () => {
  // Valid Kingside (O-O) and Queenside (O-O-O) castling
  const bothCastle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const moves = bothCastle.moves();
  assert.ok(moves.includes('O-O'));
  assert.ok(moves.includes('O-O-O'));

  const ksClone = new Chess(bothCastle.fen());
  const ksMove = ksClone.move('O-O');
  assert.equal(ksMove.san, 'O-O');
  assert.equal(ksClone.get('g1')?.type, 'k');
  assert.equal(ksClone.get('f1')?.type, 'r');
  assert.equal(analyzeMoveFeedback(ksClone, ksMove).type, 'castle');

  const qsClone = new Chess(bothCastle.fen());
  const qsMove = qsClone.move('O-O-O');
  assert.equal(qsMove.san, 'O-O-O');
  assert.equal(qsClone.get('c1')?.type, 'k');
  assert.equal(qsClone.get('d1')?.type, 'r');

  // Restriction A: Squares between King and Rook are occupied (f1 occupied by Bishop)
  const blockedCastle = new Chess('r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1');
  assert.equal(blockedCastle.moves().includes('O-O'), false);
  assert.equal(blockedCastle.moves().includes('O-O-O'), true);

  // Restriction B: King is currently in check (Black Rook on e8 checking e1)
  const inCheckCastle = new Chess('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  assert.equal(inCheckCastle.inCheck(), true);
  assert.equal(inCheckCastle.moves().includes('O-O'), false);
  assert.equal(inCheckCastle.moves().includes('O-O-O'), false);

  // Restriction C: King passes through an attacked square (f1 attacked by Black Rook on f8)
  const throughCheckCastle = new Chess('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  assert.equal(throughCheckCastle.moves().includes('O-O'), false);
  assert.equal(throughCheckCastle.moves().includes('O-O-O'), true);

  // Restriction D: King has already moved and returned to e1
  const movedKingGame = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  movedKingGame.move('Ke2');
  movedKingGame.move('Ke7');
  movedKingGame.move('Ke1');
  movedKingGame.move('Ke8');
  assert.equal(movedKingGame.moves().includes('O-O'), false);
  assert.equal(movedKingGame.moves().includes('O-O-O'), false);
});

test('4. En passant capture and restriction when en passant exposes own King to horizontal check', () => {
  // Standard legal en passant
  const epGame = new Chess(
    'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2'
  );
  const epMove = epGame.move({ from: 'e5', to: 'd6' });
  assert.ok(epMove.flags.includes('e'));
  assert.equal(epMove.captured, 'p');
  assert.equal(epGame.get('d5'), undefined);

  // En passant restriction: White King on a5, Black Pawn on d5, White Pawn on e5, Black Rook on h5.
  // Capturing exd6 e.p. removes both pawns on the 5th rank and exposes White's King on a5 to the Black Rook on h5!
  const pinnedEpGame = new Chess('6k1/8/8/K2pP2r/8/8/8/8 w - d6 0 1');
  const legalFromE5 = pinnedEpGame.moves({ square: 'e5', verbose: true });
  const canCaptureEp = legalFromE5.some((m) => m.to === 'd6');
  assert.equal(
    canCaptureEp,
    false,
    'En passant must be rejected when it exposes the moving player King to a horizontal rook attack'
  );
});

test('5. Pawn promotion to Queen, Rook, Bishop, and Knight with standard algebraic notation', () => {
  const expectedSanSuffix: Record<'q' | 'r' | 'b' | 'n', string> = {
    q: '=Q',
    r: '=R',
    b: '=B',
    n: '=N',
  };
  for (const promo of ['q', 'r', 'b', 'n'] as const) {
    const promoGame = new Chess('8/P5k1/8/8/8/8/8/4K3 w - - 0 1');
    const pm = promoGame.move({ from: 'a7', to: 'a8', promotion: promo });
    assert.equal(pm.promotion, promo);
    assert.ok(pm.san.includes(expectedSanSuffix[promo]));
    assert.equal(promoGame.get('a8')?.type, promo);
  }
});

test('6. Check, Checkmate, Stalemate, Insufficient Material, Threefold Repetition, and 50-Move Rule', () => {
  // Fool's Mate checkmate
  const mateGame = new Chess();
  mateGame.move('f3');
  mateGame.move('e5');
  mateGame.move('g4');
  const mateMove = mateGame.move('Qh4#');
  assert.equal(mateGame.isCheckmate(), true);
  assert.equal(mateGame.isGameOver(), true);
  assert.equal(analyzeMoveFeedback(mateGame, mateMove).type, 'checkmate');

  // Stalemate
  const stalemateGame = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(stalemateGame.isStalemate(), true);
  assert.equal(stalemateGame.isDraw(), true);

  // Insufficient material (K vs K, K+B vs K, K+N vs K)
  assert.equal(
    new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1').isInsufficientMaterial(),
    true
  );
  assert.equal(
    new Chess('8/8/4k3/8/8/4KB2/8/8 w - - 0 1').isInsufficientMaterial(),
    true
  );
  assert.equal(
    new Chess('8/8/4k3/8/8/4KN2/8/8 w - - 0 1').isInsufficientMaterial(),
    true
  );

  // Threefold repetition
  const repGame = new Chess();
  for (let cycle = 0; cycle < 2; cycle++) {
    repGame.move('Nf3');
    repGame.move('Nf6');
    repGame.move('Ng1');
    repGame.move('Ng8');
  }
  assert.equal(repGame.isThreefoldRepetition(), true);
  assert.equal(repGame.isDraw(), true);

  // Fifty-move rule (100 half-moves without pawn advance or capture)
  const fiftyMoveGame = new Chess('8/8/4k3/8/8/4K3/4R3/8 w - - 100 75');
  assert.equal(fiftyMoveGame.isDraw(), true);
});

test('7. Move history numbering, SAN accuracy, and Undo state restoration (turn, castling, en passant)', () => {
  const chess = new Chess();
  chess.move('e4');
  chess.move('e5');
  chess.move('Nf3');
  chess.move('Nc6');
  chess.move('Bb5');

  const pairs = groupMoveHistory(chess.history({ verbose: true }));
  assert.equal(pairs.length, 3);
  assert.equal(pairs[0].moveNumber, 1);
  assert.equal(pairs[0].white?.san, 'e4');
  assert.equal(pairs[0].black?.san, 'e5');
  assert.equal(pairs[1].moveNumber, 2);
  assert.equal(pairs[1].white?.san, 'Nf3');
  assert.equal(pairs[1].black?.san, 'Nc6');
  assert.equal(pairs[2].moveNumber, 3);
  assert.equal(pairs[2].white?.san, 'Bb5');
  assert.equal(pairs[2].black, undefined);

  // Verify Undo restores FEN (turn, castling rights, en passant square)
  const fenBeforeEp =
    'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
  const epRestore = new Chess(fenBeforeEp);
  epRestore.move({ from: 'e5', to: 'd6' });
  epRestore.undo();
  assert.equal(epRestore.fen(), fenBeforeEp);
  assert.equal(epRestore.turn(), 'w');
});

test('8. AI difficulty comparison: Easy, Medium, and Hard on deterministic tactical positions', () => {
  // Position A: Forced Mate in 1 for White (Qxf7#)
  const mateInOneFen =
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const medMate = findBestMove(mateInOneFen, 'medium');
  const hardMate = findBestMove(mateInOneFen, 'hard');
  assert.ok(medMate);
  assert.ok(hardMate);
  assert.equal(medMate.move.san, 'Qxf7#');
  assert.equal(hardMate.move.san, 'Qxf7#');

  // Position B: Hanging undefended Black Queen on d5 (White Knight on c3 can capture Nxd5)
  const hangingQueenFen =
    'rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1';
  const medCapture = findBestMove(hangingQueenFen, 'medium');
  const hardCapture = findBestMove(hangingQueenFen, 'hard');
  assert.ok(medCapture);
  assert.ok(hardCapture);
  assert.equal(medCapture.move.san, 'Nxd5');
  assert.equal(hardCapture.move.san, 'Nxd5');

  // Position C: Compare search depths and non-top-choice variety in Easy vs Medium vs Hard
  const tacticalMidgameFen =
    'r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 6 8';
  const easyMove = findBestMove(tacticalMidgameFen, 'easy', 2);
  const mediumMove = findBestMove(tacticalMidgameFen, 'medium');
  const hardMove = findBestMove(tacticalMidgameFen, 'hard', 0);

  assert.ok(easyMove);
  assert.ok(mediumMove);
  assert.ok(hardMove);
  assert.equal(easyMove.depthReached, 1);
  assert.equal(mediumMove.depthReached, 2);
  assert.equal(hardMove.depthReached, 3);

  // Verify all returned moves are strictly legal in the position
  const verifyChess = new Chess(tacticalMidgameFen);
  const legalSans = verifyChess.moves();
  assert.ok(legalSans.includes(easyMove.move.san));
  assert.ok(legalSans.includes(mediumMove.move.san));
  assert.ok(legalSans.includes(hardMove.move.san));
});

test('9. Material calculation and stored data validation handle edge cases safely', () => {
  const fen = 'rnb1kbnr/ppp1pppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const summary = calculateMaterialAndCaptures(fen);
  assert.equal(summary.advantage, 10);
  assert.equal(summary.advantageColor, 'w');
  assert.deepEqual(summary.capturedByWhite, ['q', 'p']);

  // Validate preferences fallback when given corrupted/malformed data
  const sanitized = validatePreferences({
    boardTheme: 'invalid-theme',
    pieceStyle: 12345,
    soundEnabled: false,
    defaultTimeControl: 'hacked',
  });
  assert.equal(sanitized.boardTheme, DEFAULT_PREFERENCES.boardTheme);
  assert.equal(sanitized.pieceStyle, DEFAULT_PREFERENCES.pieceStyle);
  assert.equal(sanitized.soundEnabled, false);
  assert.equal(sanitized.defaultTimeControl, DEFAULT_PREFERENCES.defaultTimeControl);

  // Validate recent game record schema guard
  assert.equal(isValidRecentGameRecord(null), false);
  assert.equal(isValidRecentGameRecord({ id: 'bad' }), false);
  assert.equal(
    isValidRecentGameRecord({
      id: 'g-1',
      mode: 'Play Computer',
      opponent: 'ChessVerse AI (HARD)',
      result: 'Win',
      scoreLabel: '1–0',
      reason: 'Checkmate',
      moves: 24,
      timeControl: 'Blitz',
      dateLabel: 'Today',
      finalFen: new Chess().fen(),
    }),
    true
  );

  const hint = getEvaluatedHint(new Chess().fen());
  assert.ok(hint);
  assert.ok(hint.san.length > 0);
});

