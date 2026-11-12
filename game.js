/** Чистая офлайн-механика «Софизмов»: без React Native и побочных эффектов. */
const pack25 = require('./data/pack25.json');
const cards = require('./data/catalog.json');
const base45 = require('./data/cards45.json');
const pack63 = require('./data/pack63.json');
const CARDS = cards.map(card => ({ ...card, short: card.description }));
const PACKS = [
  { id: 'basic25', name: 'Классический · 25', description: 'Сбалансированный набор для первой партии', ids: pack25 },
  { id: 'extended45', name: 'Большой · 45', description: 'Расширенная колода из 45 софизмов', ids: base45.map(c => c.id) },
  { id: 'canonical63', name: 'Энциклопедия · 63', description: '63 темы из архива разобранных софизмов', ids: pack63 },
];
const getCard = id => CARDS.find(c => c.id === id) || null;
const getPlayer = (game, id) => (game?.players || []).find(p => p.id === id) || null;
const disputants = game => (game?.players || []).filter(p => p.roles.includes('disputant'));
const guessers = game => (game?.players || []).filter(p => p.roles.includes('guesser'));
const activeCount = game => Object.values(game?.active || {}).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
const isGameOver = game => !!game?.finishedReason;
const points = stats => stats?.score || 0;
function selectRoles(roles, role, allowDualRoles) {
  if (!allowDualRoles) return [role];
  if (!roles.includes(role)) return [...roles, role];
  return roles.length === 1 ? roles : roles.filter(current => current !== role);
}
const toInt = (v, fallback) => Number.isInteger(Number(v)) ? Number(v) : fallback;
function shuffle(source, random = Math.random) {
  const a = source.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function validateConfig(players, opts) {
  if (!Array.isArray(players) || players.length < 2) throw new Error('Нужно минимум два участника.');
  const people = players.map(p => ({ id: String(p.id), name: String(p.name || '').trim(), roles: [...(p.roles || [])] }));
  if (people.some(p => !p.id || !p.name || p.roles.length === 0 || p.roles.some(r => !['guesser', 'disputant'].includes(r)))) throw new Error('Проверьте имена и роли игроков.');
  if (new Set(people.map(p => p.id)).size !== people.length || new Set(people.map(p => p.name.toLocaleLowerCase('ru'))).size !== people.length) throw new Error('Имена и ID игроков не должны повторяться.');
  const spies = people.filter(p => p.roles.includes('disputant'));
  const detectives = people.filter(p => p.roles.includes('guesser'));
  if (!spies.length || !detectives.length) throw new Error('Нужны спорщик и отгадчик.');
  if (opts.allowDualRoles === false && people.some(p => p.roles.length > 1)) throw new Error('Совмещение ролей отключено.');
  const count = toInt(opts.activePerDisputant, 3);
  if (count < 1 || count > 8) throw new Error('Выберите от 1 до 8 активных карт.');
  const duration = toInt(opts.durationSeconds, 1200);
  if (duration < 1 || duration > 5999) throw new Error('Продолжительность: от 1 секунды до 99:59.');
  const bank = toInt(opts.errorBank, 20);
  if (bank < 0 || bank > 999) throw new Error('Банк ошибок: от 0 до 999.');
  const ids = opts.packIds || pack25;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !getCard(id))) throw new Error('В наборе неизвестные либо повторяющиеся софизмы.');
  if (ids.length < spies.length * count) throw new Error(`Для ${spies.length} спорщиков нужно минимум ${spies.length * count} разных карт.`);
  return { people, spies, ids, count, duration, bank };
}
function createGame(players, options = {}, random = Math.random) {
  // Предусмотрен объект настроек; устаревшая числовая форма — только для обратной совместимости.
  if (typeof options === 'number') options = { durationSeconds: options };
  const cfg = validateConfig(players, options);
  const deck = shuffle(cfg.ids, random);
  const active = Object.fromEntries(cfg.spies.map(p => [p.id, []]));
  for (let i = 0; i < cfg.count; i++) for (const p of cfg.spies) active[p.id].push(deck.pop());
  return {
    version: 2, id: `game-${Date.now()}`, players: cfg.people, packIds: cfg.ids.slice(),
    active, deck, discard: [], errorBank: cfg.bank, bankLeft: cfg.bank,
    activePerDisputant: cfg.count, durationSeconds: cfg.duration, allowDualRoles: options.allowDualRoles !== false,
    stats: Object.fromEntries(cfg.people.map(p => [p.id, { right: 0, wrong: 0, score: 0, solved: 0, discarded: 0 }])),
    history: [], startedAt: new Date().toISOString(), finishedReason: null,
  };
}
function drawReplacement(game, disputantId, random = Math.random) {
  let deck = game.deck.slice();
  let discard = game.discard.slice();
  if (!deck.length && discard.length) { deck = shuffle(discard, random); discard = []; }
  if (!deck.length) return { ...game, deck, discard };
  const next = deck.pop();
  return { ...game, deck, discard, active: { ...game.active, [disputantId]: [...game.active[disputantId], next] } };
}
function replaceDisputantCard(game, disputantId, cardId, random = Math.random) {
  if (isGameOver(game)) throw new Error('Партия завершена.');
  if (!getPlayer(game, disputantId)?.roles.includes('disputant')) throw new Error('Спорщик не найден.');
  const list = game.active[disputantId] || [];
  if (!list.includes(cardId)) throw new Error('У спорщика нет выбранной карты.');
  const stats = { ...game.stats, [disputantId]: { ...game.stats[disputantId], discarded: game.stats[disputantId].discarded + 1 } };
  const event = { type: 'discard', at: new Date().toISOString(), disputantId, cardId };
  return drawReplacement({ ...game, stats, history: [...game.history, event], active: { ...game.active, [disputantId]: list.filter(id => id !== cardId) }, discard: [...game.discard, cardId] }, disputantId, random);
}
function isCorrectGuess(game, cardId, disputantId) { return !!(game?.active?.[disputantId] || []).includes(cardId); }
function resolveGuess(game, { cardId, disputantId, guesserId }, random = Math.random) {
  if (!game || isGameOver(game)) throw new Error('Партия завершена или ещё не началась.');
  const target = getPlayer(game, disputantId);
  const guesser = getPlayer(game, guesserId);
  if (!target?.roles.includes('disputant') || !guesser?.roles.includes('guesser')) throw new Error('Выберите спорщика и отгадчика.');
  if (disputantId === guesserId) throw new Error('Нельзя угадывать свои тайные карты.');
  if (!game.packIds.includes(cardId)) throw new Error('Софизм не входит в выбранный набор.');
  const correct = isCorrectGuess(game, cardId, disputantId);
  const bankDelta = correct ? 0 : game.bankLeft > 0 ? -1 : 0;
  const scoreDelta = correct ? 1 : bankDelta ? 0 : -1;
  const stats = { ...game.stats,
    [guesserId]: { ...game.stats[guesserId], score: game.stats[guesserId].score + scoreDelta, right: game.stats[guesserId].right + (correct ? 1 : 0), wrong: game.stats[guesserId].wrong + (correct ? 0 : 1) },
  };
  let next = { ...game, stats, bankLeft: game.bankLeft + bankDelta, history: [...game.history, { type: 'guess', at: new Date().toISOString(), cardId, disputantId, guesserId, correct, bankDelta, scoreDelta }] };
  let newCardId = null;
  if (correct) {
    next.active = { ...next.active, [disputantId]: next.active[disputantId].filter(id => id !== cardId) };
    next.stats = { ...next.stats, [disputantId]: { ...next.stats[disputantId], solved: next.stats[disputantId].solved + 1 } };
    // При обновлении колоды сначала используем другие карты из сброса.
    const canDrawOtherCard = next.deck.length > 0 || next.discard.length > 0;
    if (!canDrawOtherCard) next.discard = [cardId];
    next = drawReplacement(next, disputantId, random);
    if (canDrawOtherCard) next.discard = [...next.discard, cardId];
    if (next.active[disputantId].length === game.active[disputantId].length) {
      newCardId = next.active[disputantId].at(-1);
    }
  }
  return { correct, scoreDelta, bankDelta, game: next, hasNewCard: newCardId !== null, newCardId };
}
function finishGame(game, reason = 'manual') {
  if (!game || game.finishedReason) return game;
  return { ...game, finishedReason: reason, endedAt: new Date().toISOString() };
}
function standings(game) {
  return guessers(game).map(p => ({ ...p, ...game.stats[p.id] })).sort((a,b)=>b.score-a.score || b.right-a.right || a.wrong-b.wrong);
}
module.exports = { CARDS, PACKS, getCard, getPlayer, disputants, guessers, activeCount, isGameOver, points, selectRoles, shuffle, validateConfig, createGame, isCorrectGuess, replaceDisputantCard, resolveGuess, finishGame, standings };
