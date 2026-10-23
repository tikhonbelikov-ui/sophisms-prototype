const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CARDS, createGame, getPlayer, activeCount, resolveGuess, replaceDisputantCard,
  isGameOver, isCorrectGuess, points,
} = require('../game');
const { remainingSeconds, formatSeconds, durationFromParts } = require('../timer');
const people = [
  { id: 'a', name: 'Сергей', roles: ['disputant'] },
  { id: 'b', name: 'Маша', roles: ['disputant', 'guesser'] },
  { id: 'c', name: 'Саша', roles: ['guesser'] },
];
test('initial allocation does not duplicate secret cards', () => {
  const game = createGame(people, 300, () => 0);
  assert.equal(activeCount(game), 2);
  assert.equal(game.durationSeconds, 300);
  assert.equal(new Set(Object.values(game.active)).size, 2);
  assert.equal(game.used.length, 2);
});
test('wrong guess preserves secret and records an error', () => {
  const game = createGame(people, 300, () => 0);
  const wrong = CARDS.find(c => c.id !== game.active.a);
  const r = resolveGuess(game, { cardId: wrong.id, disputantId: 'a', guesserId: 'c' });
  assert.equal(r.correct, false);
  assert.equal(r.game.active.a, game.active.a);
  assert.equal(r.game.stats.c.wrong, 1);
  assert.equal(r.game.stats.a.missed, 1);
  assert.equal(r.game.used.length, 2);
});
test('correct guess awards points and gives an unused replacement', () => {
  const game = createGame(people, 300, () => 0);
  const previous = game.active.a;
  const r = resolveGuess(game, { cardId: previous, disputantId: 'a', guesserId: 'b' }, () => 0);
  assert.equal(r.correct, true);
  assert.equal(r.hasNewCard, true);
  assert.notEqual(r.game.active.a, previous);
  assert.equal(r.game.stats.b.right, 1);
  assert.equal(points(r.game.stats.b), 2);
  assert.equal(r.game.stats.a.solved, 1);
  assert.equal(game.stats.b.right, 0, 'old immutable game unchanged');
});
test('replacement does not bring back removed card', () => {
  let game = createGame(people, 300, () => 0);
  const seen = new Set(Object.values(game.active));
  game = replaceDisputantCard(game, 'a', () => 0);
  assert(!seen.has(game.active.a));
  assert.equal(game.used.length, 3);
  game = replaceDisputantCard(game, 'a', () => 0);
  assert.equal(game.used.length, 4);
  game = replaceDisputantCard(game, 'a', () => 0);
  assert.equal(game.active.a, null);
  assert.equal(activeCount(game), 1);
});
test('game ends after all active cards are replaced beyond deck', () => {
  let game = createGame(people, 300, () => 0);
  game = replaceDisputantCard(game, 'a', () => 0);
  game = replaceDisputantCard(game, 'b', () => 0);
  game = replaceDisputantCard(game, 'a', () => 0);
  game = replaceDisputantCard(game, 'b', () => 0);
  assert.equal(isGameOver(game), true);
});
test('same player can have both roles; correct check respects target', () => {
  const game = createGame(people, 300, () => 0);
  assert.equal(getPlayer(game, 'b').roles.length, 2);
  assert.equal(isCorrectGuess(game, game.active.a, 'a'), true);
  assert.equal(isCorrectGuess(game, game.active.a, 'b'), false);
});
test('invalid player roles and more disputants than cards are rejected', () => {
  assert.throws(() => createGame([{id:'x',name:'X',roles:['guesser']}]), /спорщик/);
  assert.throws(() => createGame(Array.from({length:5},(_,i)=>({id:String(i),name:String(i),roles:['disputant','guesser']}))), /не более/);
});
test('timer formats, validates and uses a deadline', () => {
  assert.equal(formatSeconds(300), '05:00');
  assert.equal(formatSeconds(0), '00:00');
  assert.equal(durationFromParts('05','30'), 330);
  assert.equal(durationFromParts('00','00'), null);
  assert.equal(durationFromParts('05','61'), null);
  assert.equal(remainingSeconds(13000, 10500), 3);
  assert.equal(remainingSeconds(13000, 13000), 0);
  assert.equal(remainingSeconds(13000, 14000), 0);
});
