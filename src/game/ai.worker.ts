import { findBestMove, Difficulty } from './engine';

export interface AIWorkerRequest {
  id: number;
  fen: string;
  difficulty: Difficulty;
}

export interface AIWorkerResponse {
  id: number;
  from: string;
  to: string;
  promotion?: string;
  san: string;
  evaluation: number;
  depthReached: number;
}

self.onmessage = (event: MessageEvent<AIWorkerRequest>) => {
  const { id, fen, difficulty } = event.data;
  const result = findBestMove(fen, difficulty);
  if (result) {
    const response: AIWorkerResponse = {
      id,
      from: result.move.from,
      to: result.move.to,
      promotion: result.move.promotion,
      san: result.move.san,
      evaluation: result.evaluation,
      depthReached: result.depthReached,
    };
    self.postMessage(response);
  } else {
    self.postMessage({ id, error: true });
  }
};
