import React,{useCallback,useEffect,useRef,useState} from 'react';
import {BackHandler,FlatList,Pressable,ScrollView,Text,View} from 'react-native';
import {Txt,Action,Panel,Topbar,Chip,LineInput,Accordion} from './components';
import {useQuizProgress} from './useQuizProgress';
const {LESSON_IDS,startLesson,submitAnswer,nextQuestion,getQuestions,statistics,score}=require('./quiz');
const index=require('./data/article_index.json');
const {colors,spacing:S,radius:R}=require('./theme');
const p=colors.read;
const gutter={padding:S.base,paddingBottom:S.xl,gap:S.base};
const date=value=>new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function Progress({value,max,label}){return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max,now:value}} style={{height:6,backgroundColor:p.line,borderRadius:9,overflow:'hidden'}}><View style={{height:6,width:`${max?value/max*100:0}%`,backgroundColor:p.accent}}/></View>}
function Stat({value,label}){return <View style={{flex:1,minWidth:75,alignItems:'center',gap:S.xs}}><Txt theme="read" variant="subtitle" style={{fontSize:23}}>{value}</Txt><Txt theme="read" variant="caption" style={{textAlign:'center',fontSize:12}}>{label}</Txt></View>}

export default function QuizSection({initialLessonId,onHome,onRead,onStageChange}){
 const {progress,ready,busy,error,load,update}=useQuizProgress();
 const [stage,setStage]=useState('catalog'),[lesson,setLesson]=useState(null),[resultId,setResultId]=useState(null);
 const [resultReturn,setResultReturn]=useState('catalog'),[choice,setChoice]=useState(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const initialized=useRef(false);
 const begin=useCallback(async id=>{
  const next=await update(old=>startLesson(old,id));
  if(next){setLesson(id);setChoice(null);setStage('question');}
 },[update]);
 useEffect(()=>{onStageChange(stage)},[stage,onStageChange]);
 useEffect(()=>{if(ready&&!initialized.current){initialized.current=true;if(initialLessonId&&index[initialLessonId])begin(initialLessonId);}},[ready,initialLessonId,begin]);
 const back=useCallback(()=>{
  if(busy)return true;
  if(stage==='catalog'){onHome();return true;}
  setChoice(null);setStage(stage==='result'?resultReturn:'catalog');return true;
 },[stage,resultReturn,onHome,busy]);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',back);return()=>sub.remove()},[back]);
 const summary=statistics(progress);
 const draft=progress.drafts[lesson];
 const questions=lesson?getQuestions(lesson):[];
 const current=draft?questions[draft.cursor]:null;
 const answered=draft?.answers[draft.cursor];
 const title=stage==='question'?index[lesson]?.name:stage==='result'?'Результат':stage==='history'?'История результатов':'Тесты';
 const errorBanner=error?<Panel theme="read"><Txt theme="read" accessibilityRole="alert" style={{color:p.danger}}>{error}</Txt>{!ready&&<Action theme="read" title="Повторить загрузку" onPress={load}/>}</Panel>:null;
 const check=async()=>{if(choice!==null&&!busy)await update(old=>submitAnswer(old,lesson,choice));};
 const advance=async()=>{
  const next=await update(old=>nextQuestion(old,lesson));
  if(!next)return;
  setChoice(null);
  if(!next.drafts[lesson]){setResultId(next.attempts.at(-1).id);setResultReturn('catalog');setStage('result');}
 };
 const openResult=(attempt)=>{setResultId(attempt.id);setResultReturn('history');setStage('result');};
 let body;
 if(!ready){body=<View style={gutter}><Txt theme="read">{error?'Результаты пока недоступны.':'Загружаем результаты…'}</Txt>{errorBanner}</View>;}
 else if(stage==='catalog'){
  const items=LESSON_IDS.filter(id=>{
   const stats=statistics(progress,id),active=!!progress.drafts[id];
   return index[id].name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))&&
    (filter==='all'||filter==='new'&&!stats.completed&&!active||filter==='active'&&active||filter==='done'&&stats.completed>0);
  });
  const latestDraft=Object.values(progress.drafts).sort((a,b)=>b.startedAt-a.startedAt)[0];
  body=<FlatList data={items} keyExtractor={id=>id} contentContainerStyle={gutter} ItemSeparatorComponent={()=> <View style={{height:S.md}}/>}
   ListHeaderComponent={<View style={{gap:S.base,marginBottom:S.base}}>
    <Txt theme="read" variant="label">ПРАКТИКА КРИТИЧЕСКОГО МЫШЛЕНИЯ</Txt><Txt theme="read" variant="title" style={{fontSize:30}}>Проверь себя</Txt>
    <Txt theme="read" variant="caption">63 темы · три варианта в каждом вопросе</Txt>
    <Panel theme="read" tinted><View style={{flexDirection:'row',flexWrap:'wrap',gap:S.sm}}><Stat value={summary.completed} label="прохождений"/><Stat value={`${summary.topics} / 63`} label="тем пройдено"/><Stat value={summary.total?`${summary.percent}%`:'—'} label="верных ответов"/></View><Txt theme="read" variant="caption">Статистика учитывает все завершённые попытки. Незавершённые тесты сохраняются отдельно.</Txt></Panel>
    {latestDraft&&<Action theme="read" title={`Продолжить: ${index[latestDraft.lessonId].name}`} onPress={()=>begin(latestDraft.lessonId)} disabled={busy}/>}
    <Action theme="read" title="История результатов" tone="outline" onPress={()=>setStage('history')}/>
    {errorBanner}
    <LineInput theme="read" label="Найти тест по названию" placeholder="Например, ложная дилемма" value={query} onChangeText={setQuery}/>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:S.sm}}>{[['all','Все'],['new','Не начаты'],['active','В процессе'],['done','Пройдены']].map(([id,label])=><Chip key={id} theme="read" label={label} selected={filter===id} onPress={()=>setFilter(id)}/>)}</View>
   </View>}
   ListEmptyComponent={<Panel theme="read"><Txt theme="read">Нет тестов по выбранному фильтру.</Txt><Action theme="read" title="Сбросить фильтры" tone="outline" onPress={()=>{setFilter('all');setQuery('')}}/></Panel>}
   renderItem={({item:id})=>{
    const stats=statistics(progress,id),active=progress.drafts[id];
    return <Panel theme="read"><Txt theme="read" variant="subtitle">{index[id].name}</Txt><Txt theme="read" variant="caption">{index[id].quizCount} вопросов{stats.completed?` · пройдено ${stats.completed} раз(а)`:''}</Txt>
     {stats.best&&<Txt theme="read" variant="caption">Лучший результат: {score(stats.best).correct} / {score(stats.best).total} · {score(stats.best).percent}%</Txt>}
     {stats.last&&<Txt theme="read" variant="caption">Последний: {score(stats.last).percent}% · {date(stats.last.completedAt)}</Txt>}
     {active&&<><Progress value={active.answers.length} max={active.questionCount} label="Отвечено вопросов"/><Txt theme="read" variant="caption">Сохранено ответов: {active.answers.length} из {active.questionCount}</Txt></>}
     <Action theme="read" title={active?'Продолжить':stats.completed?'Пройти ещё раз':'Начать тест'} tone={active?'primary':'outline'} onPress={()=>begin(id)} disabled={busy}/>
    </Panel>;
   }}/>
 }else if(stage==='question'&&draft&&current){
  const selected=answered?answered.choice:choice;
  body=<ScrollView key={`${draft.id}-${draft.cursor}`} contentContainerStyle={gutter}>
   <View style={{flexDirection:'row',justifyContent:'space-between',gap:S.sm,flexWrap:'wrap'}}><Txt theme="read" variant="label">ВОПРОС {draft.cursor+1} ИЗ {draft.questionCount}</Txt><Txt theme="read" variant="caption">{draft.answers.length} ответов сохранено</Txt></View>
   <Progress value={draft.answers.length} max={draft.questionCount} label="Прогресс теста"/>
   <Panel theme="read"><Txt theme="read" style={{fontSize:19,lineHeight:29}}>{current.question}</Txt></Panel>
   <Txt theme="read" variant="caption">Выбери, как устроен этот аргумент.</Txt>
   <View accessibilityRole="radiogroup" accessibilityLabel="Варианты ответа" style={{gap:S.md}}>{current.answers.map((a,i)=>{
    const selectedHere=selected===i,correct=answered&&a.correct,wrong=answered&&selectedHere&&!a.correct;
    const border=correct?p.success:wrong?p.danger:selectedHere?p.accent:p.line;
    return <Pressable key={i} accessibilityRole="radio" accessibilityLabel={a.text} accessibilityState={{checked:selectedHere,disabled:!!answered||busy}} disabled={!!answered||busy} onPress={()=>setChoice(i)} style={{minHeight:64,borderWidth:1,borderColor:border,borderRadius:R.md,padding:S.base,flexDirection:'row',gap:S.md,alignItems:'center',backgroundColor:selectedHere?p.accentSoft:p.surface}}>
     <View style={{width:24,height:24,borderRadius:12,borderWidth:selectedHere?7:1,borderColor:border}}/>
     <View style={{flex:1,gap:S.xs}}><Txt theme="read" style={{fontWeight:selectedHere?'700':'500'}}>{i===1?'Не является софизмом':a.text}</Txt>{i===1&&<Txt theme="read" variant="caption">Корректная аргументация</Txt>}{answered&&a.correct&&<Txt theme="read" variant="caption" style={{color:p.success}}>Правильный ответ</Txt>}</View>
    </Pressable>;
   })}</View>
   {answered&&<Panel theme="read" tinted><Txt theme="read" variant="subtitle" accessibilityRole="alert" style={{color:answered.correct?p.success:p.danger}}>{answered.correct?'Верно':'Не совсем'}</Txt><Txt theme="read">{current.explanation}</Txt></Panel>}
   {errorBanner}
   <Action theme="read" title={busy?'Сохраняем…':answered?(draft.cursor+1===draft.questionCount?'Завершить и сохранить результат':'Следующий вопрос'):'Проверить ответ'} disabled={busy||!answered&&choice===null} onPress={answered?advance:check}/>
   <Action theme="read" title="Сохранить и выйти" tone="outline" disabled={busy} onPress={()=>{setChoice(null);setStage('catalog')}}/>
   <Txt theme="read" variant="caption">Проверенный ответ учитывается один раз. Вернуться к тесту можно в любое время.</Txt>
  </ScrollView>;
 }else if(stage==='result'){
  const attempt=progress.attempts.find(a=>a.id===resultId);
  if(!attempt)body=<View style={gutter}><Txt theme="read">Результат не найден.</Txt><Action theme="read" title="К списку тестов" onPress={()=>setStage('catalog')}/></View>;
  else{
   const result=score(attempt),best=statistics(progress,attempt.lessonId).best,qs=getQuestions(attempt.lessonId);
   body=<ScrollView key={attempt.id} contentContainerStyle={gutter}><Txt theme="read" variant="label">ПРОХОЖДЕНИЕ СОХРАНЕНО</Txt><Txt theme="read" variant="title">{index[attempt.lessonId].name}</Txt>
    <Panel theme="read" tinted><Txt theme="read" variant="hero" style={{fontSize:48,lineHeight:56}}>{result.correct} / {result.total}</Txt><Txt theme="read" variant="subtitle">{result.percent}% верных ответов</Txt><Txt theme="read" variant="caption">Верно — {result.correct} · ошибок — {result.wrong}</Txt><Txt theme="read" variant="caption">{date(attempt.completedAt)} · лучший результат {score(best).percent}%</Txt></Panel>
    <Txt theme="read" variant="subtitle">Разбор ошибок</Txt>
    {!result.wrong&&<Panel theme="read"><Txt theme="read">Все ответы верны. Можно выбрать следующую тему.</Txt></Panel>}
    {attempt.answers.filter(a=>!a.correct).map(a=><Accordion key={a.questionIndex} title={`Вопрос ${a.questionIndex+1}`} theme="read"><Txt theme="read">{qs[a.questionIndex].question}</Txt><Txt theme="read" style={{color:p.danger}}>Твой ответ: {qs[a.questionIndex].answers[a.choice].text}</Txt><Txt theme="read" style={{fontWeight:'700'}}>Правильно: {qs[a.questionIndex].answers.find(x=>x.correct).text}</Txt><Txt theme="read">{qs[a.questionIndex].explanation}</Txt></Accordion>)}
    {errorBanner}<Action theme="read" title={progress.drafts[attempt.lessonId]?'Продолжить новый тест по теме':'Пройти ещё раз'} disabled={busy} onPress={()=>begin(attempt.lessonId)}/>
    <Action theme="read" title="Прочитать разбор софизма" tone="outline" onPress={()=>onRead(attempt.lessonId)}/><Action theme="read" title="К списку тестов" tone="outline" onPress={()=>setStage('catalog')}/><Txt theme="read" variant="caption">Предыдущие попытки остаются в истории.</Txt>
   </ScrollView>;
  }
 }else if(stage==='history'){
  body=<FlatList data={[...progress.attempts].reverse()} keyExtractor={a=>a.id} contentContainerStyle={gutter} ItemSeparatorComponent={()=> <View style={{height:S.md}}/>} ListHeaderComponent={<View style={{gap:S.md,marginBottom:S.md}}><Txt theme="read" variant="title">Твои результаты</Txt><Txt theme="read" variant="caption">Завершено прохождений: {summary.completed}. Нажми на результат, чтобы разобрать ошибки.</Txt></View>} ListEmptyComponent={<Panel theme="read"><Txt theme="read">Здесь появятся результаты после первого завершённого теста.</Txt><Action theme="read" title="Выбрать тест" onPress={()=>setStage('catalog')}/></Panel>} renderItem={({item:a})=><Pressable accessibilityRole="button" onPress={()=>openResult(a)}><Panel theme="read"><Txt theme="read" variant="subtitle">{index[a.lessonId].name}</Txt><Txt theme="read">{score(a).correct} / {a.questionCount} · {score(a).percent}%</Txt><Txt theme="read" variant="caption">{date(a.completedAt)} · разбор ошибок →</Txt></Panel></Pressable>}/>;
 }
 return <View style={{flex:1,backgroundColor:p.bg}}><Topbar title={title||'Тесты'} theme="read" onBack={back}/>{body}</View>;
}
