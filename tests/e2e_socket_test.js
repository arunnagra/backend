const io = require('socket.io-client');

const SERVER = process.env.SERVER || 'http://localhost:5000';

function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function run() {
  console.log('E2E socket test starting against', SERVER);

  const a = io(SERVER, { reconnectionDelay: 0, forceNew: true });
  const b = io(SERVER, { reconnectionDelay: 0, forceNew: true });

  a.on('connect', () => console.log('A connected', a.id));
  b.on('connect', () => console.log('B connected', b.id));

  await new Promise(r=>{ a.once('connect', r); });
  await new Promise(r=>{ b.once('connect', r); });

  // Create a tic-tac-toe room with A as host
  const roomRes = await new Promise((res) => {
    a.emit('create_room', { username: 'Alice', game: 'tic-tac-toe' }, (payload) => res(payload));
  });

  console.log('Room created:', roomRes.roomId);
  const roomId = roomRes.roomId;

  // B joins
  const joinRes = await new Promise((res) => {
    b.emit('join_room', { roomId, username: 'Bob' }, (payload) => res(payload));
  });
  console.log('B joined:', joinRes.players?.map(p=>p.username));

  // start game by host
  a.emit('start_game', { roomId });
  console.log('Start requested');

  // play a quick tic-tac-toe sequence
  let winner = null;
  const onRoom = (data) => {
    console.log('roomData update:', data.board, 'turn', data.turn, 'winner', data.winner);
    if (data.winner) winner = data.winner;
  };

  a.on('roomData', onRoom);
  b.on('roomData', onRoom);

  // moves: A(X)->0, B(O)->1, A->4, B->2, A->8 (win X 0,4,8)
  await wait(200);
  a.emit('makeMove', { roomId, index: 0, symbol: 'X' });
  await wait(200);
  b.emit('makeMove', { roomId, index: 1, symbol: 'O' });
  await wait(200);
  a.emit('makeMove', { roomId, index: 4, symbol: 'X' });
  await wait(200);
  b.emit('makeMove', { roomId, index: 2, symbol: 'O' });
  await wait(200);
  a.emit('makeMove', { roomId, index: 8, symbol: 'X' });

  // wait for recording
  await wait(1000);

  if (winner) console.log('TicTacToe winner:', winner);
  else console.warn('No winner observed');

  // MemoryMatch flip test
  a.emit('memory_flip', { roomId, card: { index: 0 } });
  b.emit('memory_flip', { roomId, card: { index: 1 } });
  await wait(300);

  // Quiz test: send finalScore from both sides
  a.emit('quiz_answer', { roomId, player: 'Alice', finalScore: 3 });
  b.emit('quiz_answer', { roomId, player: 'Bob', finalScore: 2 });
  await wait(300);

  // Snake test
  a.emit('snake_roll', { roomId, dice: 6, position: 7, username: 'Alice' });
  b.emit('snake_roll', { roomId, dice: 3, position: 4, username: 'Bob' });
  await wait(300);

  // Chess move test
  a.emit('chess_move', { roomId, move: { from: 'e2', to: 'e4', promotion: 'q' } });
  await wait(300);

  console.log('E2E socket test complete, cleaning up.');
  a.disconnect();
  b.disconnect();
  process.exit(0);
}

run().catch(err=>{ console.error(err); process.exit(1); });
