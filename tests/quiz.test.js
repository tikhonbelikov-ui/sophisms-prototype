const test=require('node:test');const assert=require('node:assert/strict');
const {emptyProgress,startLesson,submitAnswer,nextQuestion,getQuestions,score,statistics,validateProgress,createProgressStore}=require('../quiz');
const answerAll=(p,id,correct=true)=>{p=startLesson(p,id,100);for(const q of getQuestions(id)){const choice=q.answers.findIndex(a=>a.correct===correct);p=submitAnswer(p,id,choice,200);p=nextQuestion(p,id,300);}return p;};

test('все вопросы используют три согласованных категории, именованный другой софизм не стал целевым',()=>{
 const q=getQuestions('SOF-005').find(q=>q.question.includes('дедушка'));
 assert.equal(q.answers.length,3);assert(q.answers[2].correct);
 const labels=['Разбираемый софизм','Не является софизмом (корректная аргументация)','Другой софизм'];
 for(const id of require('../quiz').LESSON_IDS)for(const q of getQuestions(id))assert.deepEqual(q.answers.map(a=>a.text),labels);
});
test('ответ нельзя поменять после проверки, повторное нажатие не даёт дополнительных баллов',()=>{
 let p=startLesson(emptyProgress(),'SOF-001');const correct=getQuestions('SOF-001')[0].answers.findIndex(a=>a.correct);
 p=submitAnswer(p,'SOF-001',correct);const same=submitAnswer(p,'SOF-001',(correct+1)%3);
 assert.equal(same,p);assert.equal(p.drafts['SOF-001'].answers.length,1);assert.equal(statistics(p).completed,0);
});
test('восстановление проверенного ответа между Проверить и Следующий вопрос',()=>{
 let p=startLesson(emptyProgress(),'SOF-001');p=submitAnswer(p,'SOF-001',1);
 const restored=validateProgress(JSON.parse(JSON.stringify(p)));
 assert.equal(restored.drafts['SOF-001'].cursor,0);assert.equal(restored.drafts['SOF-001'].answers[0].choice,1);
 p=nextQuestion(restored,'SOF-001');assert.equal(p.drafts['SOF-001'].cursor,1);
});
test('черновики разных тем не вытесняют друг друга',()=>{
 let p=startLesson(emptyProgress(),'SOF-001');p=submitAnswer(p,'SOF-001',0);
 p=startLesson(p,'SOF-002');assert.equal(Object.keys(p.drafts).length,2);
 const saved=p.drafts['SOF-001'];p=startLesson(p,'SOF-001');assert.equal(p.drafts['SOF-001'],saved);
});
test('завершение записывает попытку ровно один раз и сохраняет прошлые результаты',()=>{
 let p=answerAll(emptyProgress(),'SOF-001',true);assert.equal(p.attempts.length,1);assert.equal(score(p.attempts[0]).percent,100);
 assert.equal(p.drafts['SOF-001'],undefined);const same=nextQuestion(p,'SOF-001');assert.equal(same,p);
 p=answerAll(p,'SOF-001',false);assert.equal(p.attempts.length,2);assert.equal(statistics(p).topics,1);
 assert.equal(score(statistics(p,'SOF-001').best).percent,100);assert.equal(score(statistics(p,'SOF-001').last).percent,0);
 assert(validateProgress(JSON.parse(JSON.stringify(p))));
});
test('общий процент вычисляется по всем ответам, а не как среднее процентов тестов',()=>{
 let p=answerAll(emptyProgress(),'SOF-001',true);p=answerAll(p,'SOF-046',false);
 assert.equal(statistics(p).total,34);assert.equal(statistics(p).percent,44);assert.equal(statistics(p).topics,2);
});
test('неотвеченный вопрос нельзя пропустить, повреждённые данные не принимаются',()=>{
 const p=startLesson(emptyProgress(),'SOF-001');assert.throws(()=>nextQuestion(p,'SOF-001'));
 const broken=JSON.parse(JSON.stringify(p));broken.drafts['SOF-001'].cursor=99;assert.throws(()=>validateProgress(broken));
 assert.throws(()=>validateProgress({version:4}));
});
test('ошибка записи не публикует результат, повторная запись сохраняет его',async()=>{
 let raw=null,fail=true;const adapter={getItem:async()=>raw,setItem:async(k,v)=>{if(fail)throw Error('disk');raw=v;}};
 const store=createProgressStore(adapter);await store.load();
 await assert.rejects(store.update(p=>startLesson(p,'SOF-001')));assert.equal(raw,null);
 fail=false;await store.update(p=>startLesson(p,'SOF-001'));assert(JSON.parse(raw).drafts['SOF-001']);
 const reloaded=createProgressStore(adapter);assert((await reloaded.load()).drafts['SOF-001']);
});
test('параллельные запросы сохранения не теряют черновики и ошибка чтения не перезаписывает историю',async()=>{
 let raw=null;const store=createProgressStore({getItem:async()=>raw,setItem:async(k,v)=>{raw=v;}});await store.load();
 await Promise.all([store.update(p=>startLesson(p,'SOF-001')),store.update(p=>startLesson(p,'SOF-002'))]);
 assert.equal(Object.keys(JSON.parse(raw).drafts).length,2);
 let writes=0;const bad=createProgressStore({getItem:async()=>'{invalid',setItem:async()=>{writes++;}});
 await assert.rejects(bad.load());await assert.rejects(bad.update(p=>startLesson(p,'SOF-001')));assert.equal(writes,0);
});
