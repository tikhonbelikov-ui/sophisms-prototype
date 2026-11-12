const test = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, PACKS, createGame, resolveGuess, isCorrectGuess, replaceDisputantCard, finishGame, standings, selectRoles } = require('../game');
const people=[{id:'s',name:'Сергей',roles:['disputant']},{id:'d',name:'Даша',roles:['disputant','guesser']},{id:'g',name:'Галя',roles:['guesser']}];
const start=(cfg={})=>createGame(people,{...{packIds:PACKS[0].ids,activePerDisputant:3,errorBank:20},...cfg},()=>0.42);
test('готовые паки 25/45/63 и стабильные идентификаторы',()=>{assert.equal(PACKS[0].ids.length,25);assert.equal(PACKS[1].ids.length,45); assert.equal(PACKS[2].ids.length,63); assert.equal(new Set(PACKS[2].ids).size,63);assert.ok(CARDS.length>=63);assert.equal(new Set(CARDS.map(x=>x.id)).size,CARDS.length)});
test('без повторов, три тайные карты на спорщика',()=>{const g=start();assert.equal(g.active.s.length,3);assert.equal(g.active.d.length,3);assert.equal(new Set([...g.active.s,...g.active.d]).size,6)});
test('правильная попытка +1 и замена только указанной карты',()=>{const g=start();const id=g.active.s[0];const r=resolveGuess(g,{cardId:id,disputantId:'s',guesserId:'g'},()=>0);assert.equal(r.correct,true);assert.equal(r.scoreDelta,1);assert.equal(r.game.stats.g.score,1);assert.equal(r.game.stats.g.right,1);assert.equal(r.game.active.s.length,3);assert.equal(r.game.active.s.includes(id),false);assert.equal(g.stats.g.score,0);assert.equal(r.game.bankLeft,20)});
test('ошибки 1..20 списывают общий банк без штрафа',()=>{let g=start();const card=g.active.s[0];const wrong=PACKS[0].ids.find(x=>!g.active.s.includes(x));for(let i=0;i<20;i++){const r=resolveGuess(g,{cardId:wrong,disputantId:'s',guesserId:'g'});assert.equal(r.scoreDelta,0);g=r.game;}assert.equal(g.bankLeft,0);assert.equal(g.stats.g.score,0);assert.equal(g.stats.g.wrong,20);assert.equal(g.active.s.includes(card),true)});
test('21-я ошибка −1, отрицательные баллы разрешены',()=>{let g=start({errorBank:0});const wrong=PACKS[0].ids.find(x=>!g.active.s.includes(x));const r=resolveGuess(g,{cardId:wrong,disputantId:'s',guesserId:'g'});assert.equal(r.scoreDelta,-1);assert.equal(r.game.stats.g.score,-1);assert.equal(r.game.bankLeft,0)});
test('настраиваемый банк ошибок равен 2, штраф на третьей ошибке',()=>{let g=start({errorBank:2});let wrong=PACKS[0].ids.find(x=>!g.active.s.includes(x));for(let i=0;i<3;i++)g=resolveGuess(g,{cardId:wrong,disputantId:'s',guesserId:'g'}).game;assert.equal(g.bankLeft,0);assert.equal(g.stats.g.score,-1);assert.equal(g.history.length,3)});
test('перекрывающиеся роли не дают угадать свои карты',()=>{const g=start();assert.throws(()=>resolveGuess(g,{cardId:g.active.d[0],disputantId:'d',guesserId:'d'}),/Нельзя/)});
test('совмещение ролей по настройке',()=>{assert.throws(()=>start({allowDualRoles:false}),/отключено/)});
test('без совмещения роль переключается одним нажатием, а выбранная роль остаётся',()=>{
 const roles=selectRoles(['guesser'],'disputant',false);
 assert.deepEqual(roles,['disputant']);
 assert.deepEqual(selectRoles(roles,'disputant',false),['disputant']);
 assert.deepEqual(selectRoles(roles,'guesser',false),['guesser']);
 assert.deepEqual(selectRoles(roles,'guesser',true),['disputant','guesser']);
 assert.deepEqual(selectRoles(roles,'disputant',true),['disputant']);
});
test('результат правильной догадки указывает карту из колоды, а ошибочной — ни одной',()=>{
 const g=start();
 const cardId=g.active.s[0];
 const replacement=g.deck.at(-1);
 const right=resolveGuess(g,{cardId,disputantId:'s',guesserId:'g'});
 assert.equal(right.newCardId,replacement);
 assert.equal(right.hasNewCard,true);
 assert.ok(right.game.active.s.includes(replacement));
 assert.deepEqual(right.game.active.d,g.active.d);
 const wrong=resolveGuess(g,{cardId,disputantId:'d',guesserId:'g'});
 assert.equal(wrong.newCardId,null);
 assert.equal(wrong.hasNewCard,false);
});
test('карта из сброса отслеживается даже при повторной выдаче угаданной карты',()=>{
 const g=start({packIds:PACKS[0].ids.slice(0,6)});
 const cardId=g.active.s[0];
 const result=resolveGuess(g,{cardId,disputantId:'s',guesserId:'g'},()=>0);
 assert.equal(result.newCardId,cardId);
 assert.equal(result.hasNewCard,true);
});
test('при пустой колоде другая карта из сброса выдаётся раньше только что угаданной',()=>{
 const game=start({packIds:PACKS[0].ids.slice(0,7)});
 const firstCard=game.active.s[0];
 const first=resolveGuess(game,{cardId:firstCard,disputantId:'s',guesserId:'g'});
 assert.equal(first.game.deck.length,0);
 const secondCard=first.game.active.s[0];
 const second=resolveGuess(first.game,{cardId:secondCard,disputantId:'s',guesserId:'g'},()=>0.99);
 assert.equal(second.newCardId,firstCard);
 assert.deepEqual(second.game.discard,[secondCard]);
});
test('выбор подмножества из пака и проверка минимального количества',()=>{assert.throws(()=>start({packIds:PACKS[0].ids.slice(0,5)}),/минимум/);const g=start({packIds:PACKS[0].ids.slice(0,7)});assert.equal(g.packIds.length,7)});
test('отказ от карты не приносит очков, история показывает сброс',()=>{const g=start();const x=g.active.s[0];const r=replaceDisputantCard(g,'s',x,()=>0);assert.equal(r.stats.s.discarded,1);assert.equal(r.stats.s.score,0);assert.equal(r.active.s.length,3);assert.equal(r.history.at(-1).type,'discard')});
test('запрещены повторные имена/плохие настройки',()=>{assert.throws(()=>createGame([people[0],{...people[1],name:'Сергей'}]),/повторяться/);assert.throws(()=>start({errorBank:-1}),/Банк/);assert.throws(()=>start({activePerDisputant:0}),/от 1/)});
test('окончание блокирует игру и сохраняет историю',()=>{const g=finishGame(start(),'timer');assert.equal(g.finishedReason,'timer');assert.throws(()=>resolveGuess(g,{cardId:g.active.s[0],disputantId:'s',guesserId:'g'}),/завершена/)});
test('обновление сброса не дублирует активные карты',()=>{let g=start({packIds:PACKS[0].ids.slice(0,6)});for(let i=0;i<8;i++){g=resolveGuess(g,{cardId:g.active.s[0],disputantId:'s',guesserId:'g'},()=>0).game;assert.equal(new Set([...g.active.s,...g.active.d]).size,6);}assert.equal(g.active.s.length,3)});
test('рейтинг сортирует по баллам и не включает спорщиков без роли отгадчика',()=>{let g=start();g=resolveGuess(g,{cardId:g.active.s[0],disputantId:'s',guesserId:'g'},()=>0).game;assert.equal(standings(g)[0].id,'g');assert.equal(standings(g).length,2)});
const {remainingSeconds,formatSeconds,durationFromParts}=require('../timer');
test('общий таймер: границы, длительность и формат 20 минут',()=>{
 assert.equal(formatSeconds(1200),'20:00');assert.equal(formatSeconds(0),'00:00');
 assert.equal(durationFromParts('20','00'),1200);assert.equal(durationFromParts('99','59'),5999);
 assert.equal(durationFromParts('05','61'),null);assert.equal(durationFromParts('00','00'),null);
 assert.equal(remainingSeconds(13000,10500),3);assert.equal(remainingSeconds(13000,14000),0);
});

test('пак на 63 доступен для игры и поддерживает точечную выборку',()=>{const g=start({packIds:PACKS[2].ids});assert.equal(g.packIds.length,63);const small=start({packIds:PACKS[2].ids.slice(0,8)});assert.equal(small.packIds.length,8)});
