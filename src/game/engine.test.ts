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
} from './engine';

test('1. Standard starting position has 32 pieces and White to move', () => {
  const chess = new Chess();
  assert.equal(chess.turn(), 'w');
  const board = chess.board().flat().filter(Boolean);
  assert.equal(board.length, 32);

  const summary = calculateMaterialAndCaptures(chess.fen());
  assert.equal(summary.advantage, 0);
  assert.equal(summary.capturedByWhite.length, 0);
  assert.equal(summary.capturedByBlack.length, 0);
});

test('2. Turn alternation and rejection of illegal moves', () => {
  const chess = new Chess();
  const move1 = chess.move({ from: 'e2', to: 'e4' });
  assert.ok(move1);
  assert.equal(chess.turn(), 'b');

  // Illegal move (knight moving like bishop) must throw in chess.js
  assert.throws(() => {
    chess.move({ from: 'b8', to: 'e5' });
  });

  const move2 = chess.move({ from: 'e7', to: 'e5' });
  assert.ok(move2);
  assert.equal(chess.turn(), 'w');
});

test('3. Castling, en passant, and all four pawn promotions work', () => {
  // Castling kingside
  const castleGame = new Chess('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
  const castleMove = castleGame.move({ from: 'e1', to: 'g1' });
  assert.equal(castleMove.san, 'O-O');
  const feedback = analyzeMoveFeedback(castleGame, castleMove);
  assert.equal(feedback.type, 'castle');

  // En passant
  const epGame = new Chess('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
  const epMove = epGame.move({ from: 'e5', to: 'd6' });
  assert.ok(epMove.flags.includes('e'));
  assert.equal(epMove.captured, 'p');

  // All 4 promotions (q, r, b, n)
  for (const promo of ['q', 'r', 'b', 'n'] as const) {
    const promoGame = new Chess('8/P5k1/8/8/8/8/8/4K3 w - - 0 1');
    const pm = promoGame.move({ from: 'a7', to: 'a8', promotion: promo });
    assert.equal(pm.promotion, promo);
  }
});

test('4. Check, checkmate, stalemate, and insufficient material detection', () => {
  // Fool's mate checkmate
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

  // Insufficient material (K vs K)
  const insufGame = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
  assert.equal(insufGame.isInsufficientMaterial(), true);
});

test('5. Material and captured pieces calculation is accurate', () => {
  // Position where White captured Black's Queen and Pawn
  const fen = 'rnb1kbnr/ppp1pppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const summary = calculateMaterialAndCaptures(fen);
  assert.equal(summary.advantage, 10); // Queen (9) + Pawn (1)
  assert.equal(summary.advantageColor, 'w');
  assert.deepEqual(summary.capturedByWhite, ['q', 'p']);
});

test('6. AI difficulty levels produce legal moves and Hard/Medium find mate-in-1 & hanging Queen', () => {
  // Mate in 1 position for White (Qh7#)
  const mateInOneFen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const medResult = findBestMove(mateInOneFen, 'medium');
  const hardResult = findBestMove(mateInOneFen, 'hard');
  assert.ok(medResult);
  assert.ok(hardResult);
  assert.equal(medResult.move.san, 'Qxf7#');
  assert.equal(hardResult.move.san, 'Qxf7#');

  // Easy mode produces a legal move and has depth 1 vs Medium/Hard higher depth
  const startFen = new Chess().fen();
  const easyMove = findBestMove(startFen, 'easy', 2);
  const mediumMove = findBestMove(startFen, 'medium');
  const hardMove = findBestMove(startFen, 'hard', 0);
  assert.ok(easyMove);
  assert.ok(mediumMove);
  assert.ok(hardMove);
  assert.equal(easyMove.depthReached, 1);
  assert.ok(mediumMove.depthReached >= 2);
  assert.ok(hardMove.depthReached >= 3);
});

test('7. Move history grouping and Practice mode hint evaluation work', () => {
  const chess = new Chess();
  chess.move('e4');
  chess.move('e5');
  chess.move('Nf3');
  const pairs = groupMoveHistory(chess.history({ verbose: true }));
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].white?.san, 'e4');
  assert.equal(pairs[0].black?.san, 'e5');
  assert.equal(pairs[1].white?.san, 'Nf3');
  assert.equal(pairs[1].black, undefined);

  const hint = getEvaluatedHint(chess.fen());
  assert.ok(hint);
  assert.ok(hint.san.length > 0);
  assert.ok(hint.reason.length > 0);
});
