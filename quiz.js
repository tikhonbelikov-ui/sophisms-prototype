/** Quiz sessions and statistics. Stores choices and indices, never duplicate lesson text. */
const index=require('./data/article_index.json');
const {getArticle}=require('./reader');
const STORAGE_KEY='sophisms.quiz.v1';
const LESSON_IDS=Object.keys(index);
const emptyProgress=()=>({version:1,drafts:{},attempts:[]});
const getQuestions=id=>getArticle(id)?.quizzes||[];
function requireLesson(id){if(!index[id])throw Error('Тест для этой темы недоступен.');return index[id];}
function startLesson(progress,id,now=Date.now(),token=Math.random().toString(36).slice(2)){
 requireLesson(id);
 if(progress.drafts[id])return progress;
 const draft={id:`${id}-${now}-${token}`,lessonId:id,startedAt:now,questionCount:index[id].quizCount,cursor:0,answers:[]};
 return {...progress,drafts:{...progress.drafts,[id]:draft}};
}
function submitAnswer(progress,id,choice,now=Date.now()){
 const draft=progress.drafts[id];if(!draft)throw Error('Сначала начните тест.');
 if(draft.answers.length>draft.cursor)return progress; // Duplicate taps cannot change a checked answer.
 const q=getQuestions(id)[draft.cursor];
 if(!q||!Number.isInteger(choice)||choice<0||choice>=q.answers.length)throw Error('Выберите один вариант ответа.');
 const answer={questionIndex:draft.cursor,choice,correct:q.answers[choice].correct,answeredAt:now};
 const next={...draft,answers:[...draft.answers,answer]};
 return {...progress,drafts:{...progress.drafts,[id]:next}};
}
function nextQuestion(progress,id,now=Date.now()){
 const draft=progress.drafts[id];
 if(!draft){if(progress.attempts.some(a=>a.lessonId===id))return progress;throw Error('Прохождение не найдено.');}
 if(draft.answers.length!==draft.cursor+1)throw Error('Сначала проверьте ответ.');
 if(draft.cursor+1<draft.questionCount)return {...progress,drafts:{...progress.drafts,[id]:{...draft,cursor:draft.cursor+1}}};
 const drafts={...progress.drafts};delete drafts[id];
 const attempt={...draft,completedAt:now};
 return {...progress,drafts,attempts:[...progress.attempts,attempt]};
}
function score(attempt){
 const total=attempt?.questionCount||0,correct=(attempt?.answers||[]).filter(a=>a.correct).length;
 return {total,correct,wrong:total-correct,percent:total?Math.round(correct/total*100):0};
}
function statistics(progress,id){
 const attempts=id?progress.attempts.filter(a=>a.lessonId===id):progress.attempts;
 const total=attempts.reduce((n,a)=>n+a.questionCount,0),correct=attempts.reduce((n,a)=>n+score(a).correct,0);
 const best=attempts.reduce((best,a)=>!best||score(a).percent>score(best).percent?a:best,null);
 return {completed:attempts.length,topics:new Set(attempts.map(a=>a.lessonId)).size,total,correct,percent:total?Math.round(correct/total*100):0,best,last:attempts.at(-1)||null};
}
function validateProgress(value){
 if(!value||value.version!==1||!value.drafts||Array.isArray(value.drafts)||!Array.isArray(value.attempts))throw Error('Не удалось прочитать сохранённые результаты.');
 const validate=(a,completed)=>{
  if(!a||!index[a.lessonId]||typeof a.id!=='string'||!a.id||!Number.isFinite(a.startedAt)||a.questionCount!==index[a.lessonId].quizCount||!Array.isArray(a.answers))throw Error('Сохранённый тест несовместим с текущими вопросами.');
  if(!Number.isInteger(a.cursor)||a.cursor<0||a.cursor>=a.questionCount||a.answers.length<a.cursor||a.answers.length>a.cursor+1)throw Error('Неверный прогресс теста.');
  const qs=getQuestions(a.lessonId);
  a.answers.forEach((x,i)=>{if(x.questionIndex!==i||!Number.isInteger(x.choice)||x.choice<0||x.choice>2||x.correct!==qs[i].answers[x.choice].correct||!Number.isFinite(x.answeredAt))throw Error('Не удалось проверить сохранённый ответ.');});
  if(completed&&(!Number.isFinite(a.completedAt)||a.answers.length!==a.questionCount))throw Error('Неполный результат теста.');
 };
 for(const [id,a] of Object.entries(value.drafts)){if(id!==a.lessonId)throw Error('Неверная тема теста.');validate(a,false);}
 const ids=new Set();for(const a of value.attempts){validate(a,true);if(ids.has(a.id))throw Error('Повтор результата.');ids.add(a.id);}
 return value;
}
/** Durable transactions: publish to UI only after storage acknowledges the write. */
function createProgressStore(storage,key=STORAGE_KEY){
 let current=null,queue=Promise.resolve();
 return {
  async load(){const raw=await storage.getItem(key);current=raw?validateProgress(JSON.parse(raw)):emptyProgress();return current;},
  update(transform){
   const run=queue.then(async()=>{
    if(!current)throw Error('Результаты ещё не загружены.');
    const next=transform(current);
    if(next===current)return current;
    await storage.setItem(key,JSON.stringify(next));
    current=next;return current;
   });
   queue=run.catch(()=>{});return run;
  },
 };
}
module.exports={STORAGE_KEY,LESSON_IDS,emptyProgress,startLesson,submitAnswer,nextQuestion,score,statistics,validateProgress,createProgressStore,getQuestions};
