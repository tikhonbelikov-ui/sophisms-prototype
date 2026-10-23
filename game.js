/** Локальная механика игры. Не использует сервер или сторонние библиотеки. */
const CARDS = [
  { id: 'dilemma', name: 'Ложная дилемма', short: 'Показать лишь два варианта, хотя есть и другие.', example: '«Либо ты согласен со мной, либо тебе всё равно на проблему».' },
  { id: 'person', name: 'Переход на личность', short: 'Нападать на человека вместо ответа на его довод.', example: '«Твоим расчётам нельзя верить: ты же всегда опаздываешь».' },
  { id: 'straw', name: 'Подмена тезиса', short: 'Исказить чужую мысль и опровергнуть уже искажённую версию.', example: '«Ты предлагаешь сократить собрания? Значит, обсуждать работу вообще не нужно?»' },
  { id: 'majority', name: 'Апелляция к большинству', short: 'Считать утверждение верным лишь потому, что многие с ним согласны.', example: '«Так думают все, значит, это правда».' },
];
const getCard = id => CARDS.find(card => card.id === id) || null;
const getPlayer = (game, id) => game?.players.find(player => player.id === id) || null;
const disputants = game => game.players.filter(player => player.roles.includes('disputant'));
const guessers = game => game.players.filter(player => player.roles.includes('guesser'));
const activeCount = game => Object.values(game?.active || {}).filter(Boolean).length;
const isGameOver = game => !!game && activeCount(game) === 0;
const points = stats => Math.max(0, (stats?.right || 0) * 2 - (stats?.wrong || 0));

function drawCard(game, disputantId, random = Math.random) {
  const available = CARDS.filter(card => !game.used.includes(card.id));
  if (!available.length) return { ...game, active: { ...game.active, [disputantId]: null } };
  const choice = Math.max(0, Math.min(available.length - 1, Math.floor(random() * available.length)));
  const next = available[choice].id;
  return { ...game, active: { ...game.active, [disputantId]: next }, used: [...game.used, next] };
}

function createGame(players, durationSeconds = 300, random = Math.random) {
  if (!Array.isArray(players)) {
    // Обратная совместимость со старым двухпользовательским вызовом.
    const legacyRandom = typeof durationSeconds === 'function' ? durationSeconds : random;
    return createGame([
      { id: 'p1', name: String(players || 'Сергей'), roles: ['disputant'] },
      { id: 'p2', name: String(durationSeconds || 'Маша'), roles: ['guesser'] },
    ], 300, legacyRandom);
  }
  const valid = players.map(p => ({ id: String(p.id), name: String(p.name).trim(), roles: [...p.roles] }));
  if (!valid.length || valid.some(p => !p.id || !p.name)) throw new Error('Укажите имена участников.');
  if (new Set(valid.map(p => p.id)).size !== valid.length) throw new Error('Повторяющиеся идентификаторы игроков.');
  const spies = valid.filter(p => p.roles.includes('disputant'));
  const detectives = valid.filter(p => p.roles.includes('guesser'));
  if (!spies.length || !detectives.length) throw new Error('Нужен как минимум один спорщик и один отгадчик.');
  if (spies.length > CARDS.length) throw new Error(`В пробной версии не более ${CARDS.length} спорщиков.`);
  let game = {
    players: valid, active: {}, used: [], durationSeconds: Math.max(1, Math.floor(durationSeconds)),
    stats: Object.fromEntries(valid.map(p => [p.id, { right: 0, wrong: 0, solved: 0, missed: 0 }])),
    startedAt: new Date().toISOString(),
  };
  spies.forEach(p => { game = drawCard(game, p.id, random); });
  return game;
}

function isCorrectGuess(game, cardId, disputantId) {
  const target = disputantId || disputants(game)[0]?.id;
  return !!(target && cardId && game?.active[target] === cardId);
}

function replaceDisputantCard(game, disputantId, random = Math.random) {
  const target = getPlayer(game, disputantId);
  if (!target || !target.roles.includes('disputant')) throw new Error('Спорщик не найден.');
  if (!game.active[disputantId]) return game;
  // Выданная карта больше не участвует в этой партии.
  return drawCard({ ...game, active: { ...game.active, [disputantId]: null } }, disputantId, random);
}

function resolveGuess(game, { cardId, disputantId, guesserId }, random = Math.random) {
  const target = getPlayer(game, disputantId);
  const guesser = getPlayer(game, guesserId);
  if (!target?.roles.includes('disputant') || !guesser?.roles.includes('guesser')) throw new Error('Выберите участников в соответствующих ролях.');
  if (!game.active[disputantId]) throw new Error('У этого спорщика больше нет тайной карты.');
  if (!getCard(cardId)) throw new Error('Выберите софизм из каталога.');
  const correct = isCorrectGuess(game, cardId, disputantId);
  const stats = Object.fromEntries(Object.entries(game.stats).map(([id, v]) => [id, { ...v }]));
  stats[guesserId][correct ? 'right' : 'wrong']++;
  stats[disputantId][correct ? 'solved' : 'missed']++;
  let next = { ...game, stats };
  if (correct) next = replaceDisputantCard(next, disputantId, random);
  return { correct, game: next, hasNewCard: correct && !!next.active[disputantId], finished: isGameOver(next) };
}

// Старый интерфейс: используйте только для двухпользовательской партии.
function replaceGuessedCard(game, random = Math.random) {
  if (Object.prototype.hasOwnProperty.call(game, 'active') && typeof game.active === 'string') {
    const available = CARDS.filter(c => !game.used.includes(c.id));
    if (!available.length) return { ...game, active: null };
    const c = available[Math.max(0, Math.min(available.length - 1, Math.floor(random() * available.length)))];
    return { ...game, active: c.id, used: [...game.used, c.id] };
  }
  return replaceDisputantCard(game, disputants(game)[0]?.id, random);
}

module.exports = {
  CARDS, getCard, getPlayer, disputants, guessers, activeCount, isGameOver, points,
  createGame, drawCard, isCorrectGuess, replaceDisputantCard, resolveGuess, replaceGuessedCard,
};
