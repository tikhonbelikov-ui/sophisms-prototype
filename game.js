// Четыре игровые карточки хранятся прямо в приложении и доступны без интернета.
const CARDS = [
  {
    id: 'dilemma',
    name: 'Ложная дилемма',
    short: 'Показать лишь два варианта, хотя есть и другие.',
    example: '«Либо ты согласен со мной, либо тебе всё равно на проблему».',
  },
  {
    id: 'person',
    name: 'Переход на личность',
    short: 'Нападать на человека вместо ответа на его довод.',
    example: '«Твоим расчётам нельзя верить: ты же всегда опаздываешь».',
  },
  {
    id: 'straw',
    name: 'Подмена тезиса',
    short: 'Исказить чужую мысль и опровергнуть уже искажённую версию.',
    example: '«Ты предлагаешь сократить собрания? Значит, обсуждать работу вообще не нужно?»',
  },
  {
    id: 'majority',
    name: 'Апелляция к большинству',
    short: 'Считать утверждение верным лишь потому, что многие с ним согласны.',
    example: '«Так думают все, значит, это правда».',
  },
];

function getCard(id) {
  return CARDS.find(card => card.id === id) || null;
}

function giveCard(session, random = Math.random) {
  const available = CARDS.filter(card => !session.used.includes(card.id));
  if (!available.length) return { ...session, active: null };
  const index = Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)));
  const id = available[index].id;
  return { ...session, active: id, used: [...session.used, id] };
}

function createGame(disputant, guesser, random = Math.random) {
  return giveCard({ disputant, guesser, active: null, used: [] }, random);
}

function isCorrectGuess(session, cardId) {
  return session.active !== null && session.active === cardId;
}

function replaceGuessedCard(session, random = Math.random) {
  return giveCard(session, random);
}

module.exports = { CARDS, getCard, createGame, isCorrectGuess, replaceGuessedCard };
