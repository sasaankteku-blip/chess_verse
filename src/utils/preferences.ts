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
  sidebarCollapsed: boolean;
}

export interface RecentGameRecord {
  id: string;
  mode: string;
  opponent: string;
  result: 'Win' | 'Loss' | 'Draw';
  scoreLabel: '1–0' | '0–1' | '½–½';
  reason: string;
  moves: number;
  timeControl: string;
  dateLabel: string;
  finalFen: string;
}

const STORAGE_KEY = 'chessverse_preferences_v1';
const RECENT_GAMES_KEY = 'chessverse_recent_games_v1';

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
  sidebarCollapsed: false,
};

export const INITIAL_RECENT_GAMES: RecentGameRecord[] = [
  {
    id: 'seed-1',
    mode: 'Play Computer',
    opponent: 'ChessVerse AI (Medium)',
    result: 'Win',
    scoreLabel: '1–0',
    reason: 'Checkmate',
    moves: 28,
    timeControl: 'Rapid 10m',
    dateLabel: 'Today',
    finalFen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 4 8',
  },
  {
    id: 'seed-2',
    mode: 'Two Player',
    opponent: 'Local Match',
    result: 'Draw',
    scoreLabel: '½–½',
    reason: 'Stalemate',
    moves: 42,
    timeControl: 'Blitz 5m',
    dateLabel: 'Yesterday',
    finalFen: '8/8/4k3/8/8/4K3/8/8 w - - 0 1',
  },
];

const VALID_THEMES: BoardTheme[] = ['emerald', 'walnut', 'slate'];
const VALID_PIECE_STYLES: PieceStyle[] = ['staunton', 'neo'];
const VALID_MODES: GameMode[] = ['ai', 'two-player', 'practice'];
const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const VALID_CLOCKS: TimeControl[] = ['bullet', 'blitz', 'rapid', 'unlimited'];

export function validatePreferences(input: unknown): UserPreferences {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }
  const obj = input as Record<string, unknown>;
  return {
    soundEnabled:
      typeof obj.soundEnabled === 'boolean'
        ? obj.soundEnabled
        : DEFAULT_PREFERENCES.soundEnabled,
    boardTheme: VALID_THEMES.includes(obj.boardTheme as BoardTheme)
      ? (obj.boardTheme as BoardTheme)
      : DEFAULT_PREFERENCES.boardTheme,
    pieceStyle: VALID_PIECE_STYLES.includes(obj.pieceStyle as PieceStyle)
      ? (obj.pieceStyle as PieceStyle)
      : DEFAULT_PREFERENCES.pieceStyle,
    showCoordinates:
      typeof obj.showCoordinates === 'boolean'
        ? obj.showCoordinates
        : DEFAULT_PREFERENCES.showCoordinates,
    showLegalMoves:
      typeof obj.showLegalMoves === 'boolean'
        ? obj.showLegalMoves
        : DEFAULT_PREFERENCES.showLegalMoves,
    enableAnimations:
      typeof obj.enableAnimations === 'boolean'
        ? obj.enableAnimations
        : DEFAULT_PREFERENCES.enableAnimations,
    defaultGameMode: VALID_MODES.includes(obj.defaultGameMode as GameMode)
      ? (obj.defaultGameMode as GameMode)
      : DEFAULT_PREFERENCES.defaultGameMode,
    defaultDifficulty: VALID_DIFFICULTIES.includes(
      obj.defaultDifficulty as Difficulty
    )
      ? (obj.defaultDifficulty as Difficulty)
      : DEFAULT_PREFERENCES.defaultDifficulty,
    defaultTimeControl: VALID_CLOCKS.includes(
      obj.defaultTimeControl as TimeControl
    )
      ? (obj.defaultTimeControl as TimeControl)
      : DEFAULT_PREFERENCES.defaultTimeControl,
    sidebarCollapsed:
      typeof obj.sidebarCollapsed === 'boolean'
        ? obj.sidebarCollapsed
        : DEFAULT_PREFERENCES.sidebarCollapsed,
  };
}

export function isValidRecentGameRecord(item: unknown): item is RecentGameRecord {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    typeof r.mode === 'string' &&
    typeof r.opponent === 'string' &&
    (r.result === 'Win' || r.result === 'Loss' || r.result === 'Draw') &&
    (r.scoreLabel === '1–0' ||
      r.scoreLabel === '0–1' ||
      r.scoreLabel === '½–½') &&
    typeof r.reason === 'string' &&
    typeof r.moves === 'number' &&
    Number.isFinite(r.moves) &&
    r.moves >= 0 &&
    typeof r.timeControl === 'string' &&
    typeof r.dateLabel === 'string' &&
    typeof r.finalFen === 'string'
  );
}

export function formatGameTimestamp(date: Date = new Date()): string {
  try {
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Today';
  }
}

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return validatePreferences(parsed);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    const validated = validatePreferences(prefs);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadRecentGames(): RecentGameRecord[] {
  if (typeof window === 'undefined') return INITIAL_RECENT_GAMES;
  try {
    const raw = window.localStorage.getItem(RECENT_GAMES_KEY);
    if (!raw) return INITIAL_RECENT_GAMES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_RECENT_GAMES;
    const validRecords = parsed.filter(isValidRecentGameRecord);
    return validRecords;
  } catch {
    return INITIAL_RECENT_GAMES;
  }
}

export function addRecentGame(record: RecentGameRecord): RecentGameRecord[] {
  const existing = loadRecentGames();
  const safeRecord = isValidRecentGameRecord(record) ? [record] : [];
  const updated = [
    ...safeRecord,
    ...existing.filter((g) => g.id !== record.id),
  ].slice(0, 10);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }
  return updated;
}

export function clearRecentGames(): RecentGameRecord[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify([]));
    } catch {
      // Ignore storage errors
    }
  }
  return [];
}

