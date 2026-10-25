import {
  BoardTheme,
  Difficulty,
  GameMode,
  PieceStyle,
  TimeControl,
} from '../game/engine';

export interface UserPreferences {
  soundEnabled: boolean;
  boardTheme: BoardTheme;
  pieceStyle: PieceStyle;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  enableAnimations: boolean;
  defaultGameMode: GameMode;
  defaultDifficulty: Difficulty;
  defaultTimeControl: TimeControl;
}

const STORAGE_KEY = 'chessverse_preferences_v1';

export const DEFAULT_PREFERENCES: UserPreferences = {
  soundEnabled: true,
  boardTheme: 'emerald',
  pieceStyle: 'staunton',
  showCoordinates: true,
  showLegalMoves: true,
  enableAnimations: true,
  defaultGameMode: 'ai',
  defaultDifficulty: 'medium',
  defaultTimeControl: 'rapid',
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}
