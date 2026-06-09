import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

// =============================================================================
// CONFIGURATION — change API_BASE_URL to point to your Chess API instance
// =============================================================================
const API_BASE_URL = 'http://localhost:3000';
// =============================================================================

// ── Polling interval in milliseconds ──────────────────────────────────────────
const POLL_INTERVAL_MS = 2000;

// ── Application State ─────────────────────────────────────────────────────────
const state = {
  token: null,       // JWT Bearer token
  playerId: null,    // MongoDB _id of the Player document
  gameId: null,      // MongoDB _id of the active Game document
  playerColor: null, // 'white' | 'black'
  pollingTimer: null,
  chess: null,       // chess.js instance (client-side validation)
  board: null,       // chessboard.js instance
};

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function setStatus(text, cls = '') {
  const bar = $('status-bar');
  const txt = $('status-text');
  bar.className = cls;
  txt.textContent = text;

  // Show spinner only while waiting or connecting
  const hasSpinner = bar.querySelector('.spinner');
  if (cls === 'waiting' || cls === '') {
    if (!hasSpinner) {
      const s = document.createElement('span');
      s.className = 'spinner';
      bar.prepend(s);
    }
  } else {
    if (hasSpinner) hasSpinner.remove();
  }
}

function showSetupError(msg) {
  const el = $('setup-error');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function appendMoveLog(pgn) {
  const log = $('moves-log');
  // PGN includes headers like [Event "?"] — strip them and show only the moves
  const moves = (pgn || '').replace(/\[.*?\]\s*/gs, '').trim();
  log.textContent = moves;
  log.scrollTop = log.scrollHeight;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = body?.message || `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return body;
}

// ── Step 1 — Create guest user ─────────────────────────────────────────────
async function createGuestUser(name) {
  const data = await apiFetch('/guest-users', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data; // { id, name, token }
}

// ── Step 2 — Register player ───────────────────────────────────────────────
async function registerPlayer() {
  const data = await apiFetch('/players', { method: 'POST', body: JSON.stringify({}) });
  return data; // { _id, userId, isGuest, ... }
}

// ── Step 3 — Create/join game ──────────────────────────────────────────────
async function joinGame(duration) {
  const data = await apiFetch('/games', {
    method: 'POST',
    body: JSON.stringify({ duration }),
  });
  return data; // { _id, whitePlayerId, blackPlayerId, status, fen, ... }
}

// ── Polling — Fetch current game state ────────────────────────────────────────
async function fetchGameState() {
  try {
    const [game, boardData] = await Promise.all([
      apiFetch(`/games/${state.gameId}`),
      apiFetch(`/games/${state.gameId}/board`),
    ]);
    handleGameUpdate(game, boardData);
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
  }
}

function handleGameUpdate(game, boardData) {
  const { status, whitePlayerId, blackPlayerId, pgn } = game;
  const { fen } = boardData;

  // Update chessboard position
  if (state.board && fen) {
    state.board.position(fen, false);
    try { state.chess.load(fen); } catch { /* invalid fen — keep current state */ }
  }

  // Update move log
  appendMoveLog(pgn || '');

  if (status === 'WAITING_PLAYER') {
    setStatus('Waiting for an opponent…', 'waiting');
    return;
  }

  if (status === 'CHECKMATE') {
    stopPolling();
    // Determine winner
    const winnerIsWhite = state.chess.turn() === 'b'; // the player who just moved wins
    const iWon = (winnerIsWhite && state.playerColor === 'white') ||
                 (!winnerIsWhite && state.playerColor === 'black');
    setStatus(iWon ? '🏆 Checkmate — You won!' : '💀 Checkmate — You lost.', 'over');
    return;
  }

  if (status === 'DRAW') {
    stopPolling();
    setStatus('🤝 Game ended in a draw.', 'over');
    return;
  }

  // IN_PROGRESS — determine whose turn it is
  const chessTurn = state.chess.turn(); // 'w' | 'b'
  const myTurn =
    (chessTurn === 'w' && state.playerColor === 'white') ||
    (chessTurn === 'b' && state.playerColor === 'black');

  $('turn-indicator').textContent = myTurn ? '⬤ Your turn' : '○ Opponent\'s turn';

  if (myTurn) {
    setStatus('Your turn — drag a piece to move', 'your-turn');
  } else {
    setStatus('Waiting for opponent\'s move…', 'opponent');
  }
}

// ── Board interaction ─────────────────────────────────────────────────────────
// ── Square highlight helpers ──────────────────────────────────────────────────
function clearHighlights() {
  document.querySelectorAll('#board .square-55d63').forEach((sq) => {
    sq.style.background = '';
  });
  document.querySelectorAll('#board .square-55d63.highlight-source').forEach((sq) => {
    sq.classList.remove('highlight-source');
  });
}

function highlightSquare(squareName, type) {
  const el = document.querySelector(`#board .square-${squareName}`);
  if (!el) return;
  const isDark = el.classList.contains('black-3c85d');
  if (type === 'source') {
    el.style.background = isDark ? '#4a6fa5' : '#6b9bd2';  // blue
  } else {
    el.style.background = isDark ? '#3a7d44' : '#5aab65';  // green
  }
}

function onMouseoverSquare(square, piece) {
  if (!piece) return;
  if (state.chess.isGameOver()) return;
  const myColor = state.playerColor === 'white' ? 'w' : 'b';
  // Only highlight on our turn and our pieces
  if (state.chess.turn() !== myColor) return;
  if (!piece.startsWith(myColor)) return;

  const moves = state.chess.moves({ square, verbose: true });
  if (moves.length === 0) return;

  highlightSquare(square, 'source');
  moves.forEach((m) => highlightSquare(m.to, 'target'));
}

function onMouseoutSquare() {
  clearHighlights();
}

function onDragStart(source, piece) {
  // Only allow dragging if it's our turn and game is in progress
  if (state.chess.isGameOver()) return false;
  const myColor = state.playerColor === 'white' ? 'w' : 'b';
  if (state.chess.turn() !== myColor) return false;
  if (piece.startsWith(myColor === 'w' ? 'b' : 'w')) return false;
  return true;
}

async function onDrop(source, target) {
  // Use chess.js to build the move (validates legality)
  // chess.js v1 throws on invalid moves instead of returning null
  let move;
  try {
    move = state.chess.move({ from: source, to: target, promotion: 'q' });
  } catch {
    return 'snapback';
  }

  // Revert local change and let the server state be the source of truth
  state.chess.undo();

  try {
    await apiFetch(`/games/${state.gameId}/moves`, {
      method: 'POST',
      body: JSON.stringify({ move: move.san }),
    });
    // Immediately poll to reflect the new state
    await fetchGameState();
  } catch (err) {
    setStatus(`Move error: ${err.message}`, 'error');
    return 'snapback';
  }
}

function onSnapbackEnd() {
  state.board.position(state.chess.fen(), false);
}

// ── Init chessboard ───────────────────────────────────────────────────────────
function initBoard(orientation) {
  state.chess = new Chess();
  state.board = Chessboard('board', {
    draggable: true,
    position: 'start',
    orientation,
    onDragStart,
    onDrop,
    onSnapbackEnd,
    onMouseoverSquare,
    onMouseoutSquare,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
  });

  // Resize board to fill container
  window.addEventListener('resize', () => state.board.resize());
}

// ── Polling lifecycle ─────────────────────────────────────────────────────────
function startPolling() {
  fetchGameState(); // immediate first call
  state.pollingTimer = setInterval(fetchGameState, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

// ── Determine player color ────────────────────────────────────────────────────
function resolveColor(game) {
  // game.whitePlayerId / blackPlayerId may be ObjectId strings or populated objects
  const getId = (v) => (v && typeof v === 'object' ? v._id || v.id : v);
  const wId = String(getId(game.whitePlayerId) || '');
  const bId = String(getId(game.blackPlayerId) || '');
  if (state.playerId && wId.includes(state.playerId)) return 'white';
  if (state.playerId && bId.includes(state.playerId)) return 'black';
  return 'white'; // fallback
}

// ── Main flow — called when user clicks "Enter game" ─────────────────────────
async function enterGame() {
  const btn = $('join-btn');
  const name = $('guest-name').value.trim();
  const duration = $('duration').value;

  btn.disabled = true;
  btn.textContent = 'Connecting…';
  showSetupError('');

  try {
    // 1. Guest user
    const guest = await createGuestUser(name);
    state.token = guest.token;

    // 2. Register player
    const player = await registerPlayer();
    state.playerId = String(player._id);

    // 3. Join / create game
    const game = await joinGame(duration);
    state.gameId = String(game._id);

    // 4. Determine color
    state.playerColor = resolveColor(game);

    // 5. Switch UI
    $('setup-screen').style.display = 'none';
    $('game-screen').style.display = 'block';

    // 6. Init chessboard.js
    const myColorDot = $('my-color-dot');
    myColorDot.className = `color-dot ${state.playerColor}`;
    $('my-name-label').textContent = `${name} (${state.playerColor})`;
    initBoard(state.playerColor);

    // 7. Start polling
    setStatus('Connecting…', '');
    startPolling();

  } catch (err) {
    showSetupError(err.message);
    btn.disabled = false;
    btn.textContent = 'Enter game';
  }
}

// ── Generate a random guest name ──────────────────────────────────────────────
function generateGuestName() {
  const adj = ['Swift', 'Bold', 'Calm', 'Dark', 'Iron', 'Sage', 'Wild'];
  const noun = ['Knight', 'Bishop', 'Rook', 'Queen', 'King', 'Pawn'];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${num}`;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('guest-name').value = generateGuestName();
  $('join-btn').addEventListener('click', enterGame);
});
