import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,BackHandler,Pressable,ScrollView,StatusBar,Text,View,useWindowDimensions} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Txt,Action,Panel,Topbar,Chip,LineInput,Accordion,Overlay} from './components';
import QuizSection from './QuizSection';
const {CARDS,PACKS,createGame,resolveGuess,replaceDisputantCard,finishGame,standings,disputants,guessers,getCard,getPlayer,activeCount,isGameOver,selectRoles}=require('./game');
const {getArticle,getRelated,hasFullArticle}=require('./reader');
const {preview,displaySectionParagraphs}=require('./preview');
const {colors,spacing:S}=require('./theme');
const {remainingSeconds,formatSeconds}=require('./timer');
const SAVE_KEY='sophisms.complete.v2';
const DEFAULT_PLAYERS=[{id:'p1',name:'Сергей',roles:['disputant']},{id:'p2',name:'Маша',roles:['guesser']}];
const START={players:DEFAULT_PLAYERS,packId:'basic25',selectedIds:PACKS[0].ids,errorBank:'20',activePerDisputant:'3',duration:'20',dualRoles:true};
const isRead=name=>['read','article','tests'].includes(name);
const format=(n)=>String(n).padStart(2,'0');

// Вкладки меняют раздел. Запуск и продолжение партии остаются действием главного экрана.
function NavIcon({name,color}){
 const stroke={borderColor:color,borderWidth:2};
 return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{width:24,height:24,justifyContent:'center',alignItems:'center'}}>
  {name==='home'?<View style={[stroke,{width:22,height:22,borderRadius:6,padding:4,flexDirection:'row',flexWrap:'wrap',gap:4}]}>{[0,1,2,3].map(n=><View key={n} style={{width:3,height:3,borderRadius:2,backgroundColor:color}}/>)}</View>
   :name==='read'?<View style={{flexDirection:'row'}}>{[0,1].map(n=><View key={n} style={[stroke,{width:11,height:19,borderTopLeftRadius:4,borderTopRightRadius:4}]}/>)}</View>
   :name==='tests'?<View style={[stroke,{width:20,height:22,borderRadius:4,alignItems:'center',justifyContent:'center'}]}><View style={{width:11,height:6,borderLeftWidth:2,borderBottomWidth:2,borderColor:color,transform:[{rotate:'-45deg'}],marginBottom:3}}/></View>
   :<View style={[stroke,{width:20,height:22,borderRadius:4,justifyContent:'center',paddingHorizontal:3,gap:3}]}>{[0,1,2].map(n=><View key={n} style={{height:2,backgroundColor:color}}/>)}</View>}
 </View>;
}
function Nav({onHome,onRead,onTests,onRules,active}){
 const theme=['read','tests'].includes(active)?'read':'game';const p=colors[theme];
 const tabs=[['home','Игра',onHome],['read','Софизмы',onRead],['tests','Тесты',onTests],['rules','Правила',onRules]];
 return <View accessibilityRole="tablist" style={{flexDirection:'row',paddingHorizontal:S.sm,paddingVertical:S.sm,backgroundColor:p.surface,borderTopColor:p.line,borderTopWidth:1}}>
  {tabs.map(([id,label,onPress])=>{
   const selected=active===id;const ink=selected?p.accent:p.muted;
   return <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={({pressed})=>({flex:1,minWidth:0,minHeight:64,paddingVertical:S.xs,alignItems:'center',justifyContent:'center',gap:S.xs,opacity:pressed?.65:1})}>
    <View style={{width:56,height:32,borderRadius:16,backgroundColor:selected?p.accentSoft:'transparent',alignItems:'center',justifyContent:'center'}}><NavIcon name={id} color={ink}/></View>
    <Text style={{color:ink,fontSize:13,fontWeight:selected?'800':'500',textAlign:'center',paddingHorizontal:2}}>{label}</Text>
   </Pressable>;
  })}
 </View>;
}
const blockPadding={padding:S.base,paddingBottom:S.xl,gap:S.md};
function AppInner(){
 const {height,fontScale}=useWindowDimensions();
 const scrollFooter=height<360||fontScale>=1.8;
 const [screen,setScreen]=useState('home');const [config,setConfig]=useState(START);const [game,setGame]=useState(null);
 const [remaining,setRemaining]=useState(1200);const [timerRunning,setTimerRunning]=useState(false);const deadline=useRef(null);
 const [selectedCard,setSelectedCard]=useState(null);const [currentArticle,setCurrentArticle]=useState('SOF-001');
 const [testsStage,setTestsStage]=useState('catalog');const [testLesson,setTestLesson]=useState(null);
 const [readingSearch,setReadingSearch]=useState('');const [readingFilter,setReadingFilter]=useState('all');
 const articleScrollRef=useRef(null);const articleSectionY=useRef({});
 const [deckQuery,setDeckQuery]=useState('');const [deckEditor,setDeckEditor]=useState(false);
 const [overlay,setOverlay]=useState(null);const [reveal,setReveal]=useState(null);const [secretOpen,setSecretOpen]=useState(false);
 const [guessWho,setGuessWho]=useState(null);const [guessTarget,setGuessTarget]=useState(null);
 const [restored,setRestored]=useState(false);const [savingError,setSavingError]=useState(false);
 const returnToSection=(index)=>{const y=articleSectionY.current[index];if(Number.isFinite(y))requestAnimationFrame(()=>articleScrollRef.current?.scrollTo({y:Math.max(0,y),animated:true}));};
 const theme=isRead(screen)?'read':'game';const p=colors[theme];
 const activeIds=game?.packIds||config.selectedIds;const included=CARDS.filter(c=>activeIds.includes(c.id));
 const cfgCardCount=config.selectedIds.length;const currentSpy=getPlayer(game,reveal?.queue[0]);
 const giveIds=currentSpy?game.active[currentSpy.id]||[]:[];
 const newCardId=giveIds.includes(reveal?.newCardId)?reveal.newCardId:null;
 const revealIds=newCardId?[newCardId,...giveIds.filter(id=>id!==newCardId)]:giveIds;
 const gameDisputants=disputants(game);
 const eligibleGuessers=guessers(game).filter(pl=>gameDisputants.some(target=>target.id!==pl.id));
 const guessTargets=gameDisputants.filter(pl=>pl.id!==guessWho);
 const canCheckGuess=eligibleGuessers.some(pl=>pl.id===guessWho)&&guessTargets.some(pl=>pl.id===guessTarget);
 const closeOverlay=()=>setOverlay(null);
 const showMsg=(title,description,actionTitle='Понятно')=>setOverlay({title,description,confirm:actionTitle});
 const ask=(title,description,action,confirm='Продолжить')=>setOverlay({title,description,cancel:'Отмена',confirm,onConfirm:()=>{setOverlay(null);action();}});
 const upd=(patch)=>setConfig(prev=>({...prev,...patch}));
 const pause=useCallback(()=>{if(deadline.current){setRemaining(remainingSeconds(deadline.current));deadline.current=null;}setTimerRunning(false);},[]);
 const resume=useCallback(()=>{if(remaining>0 && game&&!game.finishedReason){deadline.current=Date.now()+remaining*1000;setTimerRunning(true);}},[remaining,game]);
 const stop=(reason)=>{pause();setGame(prev=>prev?finishGame(prev,reason):null);setReveal(null);setOverlay(null);setScreen('end');};
 useEffect(()=>{let mounted=true;AsyncStorage.getItem(SAVE_KEY).then(raw=>{if(!mounted)return;try{if(raw){const d=JSON.parse(raw);if(d.config) setConfig(d.config);if(d.game?.version===2){setGame(d.game);setRemaining(d.remaining??d.game.durationSeconds);if(!isGameOver(d.game)&&d.reveal?.queue?.length)setReveal(d.reveal);setScreen('home');}}}catch(e){}setRestored(true)}).catch(()=>{setSavingError(true);setRestored(true)});return()=>{mounted=false}},[]);
 useEffect(()=>{if(!restored)return;AsyncStorage.setItem(SAVE_KEY,JSON.stringify({config,game,reveal,remaining:timerRunning&&deadline.current?remainingSeconds(deadline.current):remaining})).catch(()=>setSavingError(true));},[config,game,reveal,remaining,timerRunning,restored]);
 useEffect(()=>{if(!timerRunning)return;const t=setInterval(()=>{const n=remainingSeconds(deadline.current);setRemaining(n);if(n===0){deadline.current=null;setTimerRunning(false);setGame(prev=>prev?finishGame(prev,'timer'):prev);setOverlay({title:'Время вышло',description:'Партия завершена. Посмотрите итоговые очки и историю попыток.',confirm:'Результаты',onConfirm:()=>{setOverlay(null);setScreen('end');}});}},350);return()=>clearInterval(t);},[timerRunning]);
 useEffect(()=>{const s=AppState.addEventListener('change',state=>{if(state!=='active')pause();});return()=>s.remove()},[pause]);
 const onBack=useCallback(()=>{
  if(overlay){closeOverlay();return true}
  if(screen==='secret'){setSecretOpen(false);setScreen('handoff');return true}
  if(screen==='handoff'){if(reveal?.kind==='review'){finishHandoff();return true}showMsg('Тайная выдача','Передайте телефон спорщику и завершите просмотр карт, прежде чем продолжить игру.');return true}
  if(screen==='tests'){setScreen('home');return true}
  if(screen==='read'||screen==='setup'||screen==='rules'||screen==='end'){setScreen('home');return true}
  if(screen==='article'){setScreen('read');return true}
  if(screen==='catalog'){ask('Приостановить игру?','Таймер остановится. Партия останется сохранённой.',()=>{pause();setScreen('home')},'В меню');return true}
  if(screen==='card'){setScreen('catalog');return true}
  if(screen==='review'){setScreen('catalog');return true}
  setScreen('home');return true;
 },[screen,overlay,reveal,remaining,game]);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',onBack);return()=>sub.remove();},[onBack]);
 const navigateHome=()=>{pause();setOverlay(null);setScreen('home');};
 const newGame=()=>{const reset=()=>{pause();setGame(null);setReveal(null);setSecretOpen(false);setScreen('setup')};if(game&&!isGameOver(game))ask('Новая игра','Текущая партия и её результаты будут заменены. Вы уверены?',reset,'Начать новую');else reset();};
 const play=()=>{if(game&&!isGameOver(game)){setScreen(reveal?'handoff':'catalog');}else newGame();};
 const choosePack=(id)=>{const pack=PACKS.find(x=>x.id===id);upd({packId:id,selectedIds:pack.ids.slice()});setDeckEditor(false)};
 const toggleId=(id)=>upd({selectedIds:config.selectedIds.includes(id)?config.selectedIds.filter(x=>x!==id):[...config.selectedIds,id]});
 const updatePlayer=(id,patch)=>upd({players:config.players.map(x=>x.id===id?{...x,...patch}:x)});
 const toggleRole=(id,role)=>setConfig(prev=>({...prev,players:prev.players.map(pl=>pl.id===id?{...pl,roles:selectRoles(pl.roles,role,prev.dualRoles)}:pl)}));
 const addPlayer=()=>{if(config.players.length>=12){showMsg('Лимит игроков','Не более 12 участников.');return;}const id=`p${Date.now()}`;upd({players:[...config.players,{id,name:`Игрок ${config.players.length+1}`,roles:['guesser']}]});};
 const beginReveal=(queue,kind,resumeTimer,newCardId=null,repeatCard=false)=>{
  setSecretOpen(false);
  setReveal({queue,kind,resumeTimer,newCardId,repeatCard});
  setScreen('handoff');
 };
 const launch=()=>{
  try{
   const minutes=Number(config.duration);
   if(!Number.isInteger(minutes)||minutes<1||minutes>99)throw Error('Таймер должен быть от 1 до 99 минут.');
   const next=createGame(config.players,{packIds:config.selectedIds,durationSeconds:minutes*60,errorBank:Number(config.errorBank),activePerDisputant:Number(config.activePerDisputant),allowDualRoles:config.dualRoles});
   setGame(next);
   setRemaining(minutes*60);
   setTimerRunning(false);
   deadline.current=null;
   setSelectedCard(null);
   beginReveal(disputants(next).map(x=>x.id),'deal',true);
  }catch(e){showMsg('Невозможно начать',e.message)}
 };
 const finishHandoff=()=>{
  setSecretOpen(false);
  if(reveal?.queue.length>1){
   setReveal({...reveal,queue:reveal.queue.slice(1)});
   setScreen('handoff');
   return;
  }
  setReveal(null);
  setScreen('catalog');
  if(reveal?.resumeTimer)resume();
 };
 const swapSecret=(id)=>ask('Заменить карту?','Этот софизм отправится в сброс, а спорщик получит карту из колоды.',()=>{
  try{
   const next=replaceDisputantCard(game,currentSpy.id,id);
   setGame(next);
   if(id===newCardId&&next.active[currentSpy.id].at(-1)!==id)setReveal({...reveal,newCardId:null});
  }catch(e){showMsg('Не удалось заменить',e.message)}
 },'Заменить');
 const selectGuesser=(id)=>{
  setGuessWho(id);
  const targets=gameDisputants.filter(pl=>pl.id!==id);
  setGuessTarget(current=>targets.find(pl=>pl.id===current)?.id??(targets.length===1?targets[0].id:null));
 };
 const openGuess=(id)=>{
  if(!game||isGameOver(game))return;
  setSelectedCard(id);
  const who=eligibleGuessers.length===1?eligibleGuessers[0].id:null;
  const targets=gameDisputants.filter(pl=>pl.id!==who);
  setGuessWho(who);
  setGuessTarget(targets.length===1?targets[0].id:null);
  setOverlay({type:'guess'});
 };
 const doGuess=()=>{
  if(!canCheckGuess)return;
  try{
   const result=resolveGuess(game,{cardId:selectedCard,disputantId:guessTarget,guesserId:guessWho});
   setGame(result.game);
   if(result.correct&&result.hasNewCard){
    pause();
    beginReveal([guessTarget],'guess',timerRunning,result.newCardId,result.newCardId===selectedCard);
   }else{
    setScreen('catalog');
   }
   setOverlay({
    title:result.correct?'Верно! +1 очко':result.bankDelta?'Не угадано':'Не угадано · −1 очко',
    description:result.correct
     ? (result.hasNewCard?`Передайте телефон спорщику «${getPlayer(game,guessTarget).name}» для тайного просмотра.`:'Софизм угадан. Колода пуста.')
     : (result.bankDelta?`Из общего банка списана одна попытка. Осталось: ${result.game.bankLeft}. Очки не уменьшились.`:'Банк ошибок исчерпан. Отгадчику списано 1 очко.'),
    confirm:result.hasNewCard?'Передать телефон':'Вернуться к игре',
   });
  }catch(e){showMsg('Проверка невозможна',e.message)}
 };
 const reviewCards=(id)=>{
  pause();
  beginReveal([id],'review',timerRunning);
 };
 const openTests=(id=null)=>{pause();setTestLesson(id);setTestsStage('catalog');setScreen('tests');};
 const readCard=(id)=>{setCurrentArticle(id);setScreen('article');};
 const readingArticle=screen==='article'?getArticle(currentArticle):null;
 const readItems=CARDS.filter(c=>(readingFilter==='all'||c.difficulty===readingFilter)&&(`${c.name} ${c.description} ${c.alternative_name||''}`).toLocaleLowerCase('ru').includes(readingSearch.toLocaleLowerCase('ru')));
 const deckOptions=PACKS.find(x=>x.id===config.packId)?.ids||PACKS[0].ids;
 const deckItems=CARDS.filter(c=>deckOptions.includes(c.id)&&(`${c.name} ${c.description}`).toLocaleLowerCase('ru').includes(deckQuery.toLocaleLowerCase('ru')));
 const baseText={gap:S.md};let body=null;let title=null;let footer=null;
 if(screen==='home'){
  body=<View style={{flexGrow:1,backgroundColor:colors.game.bg,padding:S.xl,justifyContent:'center',gap:S.xl}}>
   <View style={{height:150,position:'relative',justifyContent:'center',alignItems:'center'}}>
     <View style={{position:'absolute',width:142,height:142,borderRadius:71,backgroundColor:colors.game.heroCircle,borderWidth:2,borderColor:colors.game.heroEdge}} />
     <View style={{position:'absolute',top:18,left:'15%',width:60,height:5,borderRadius:8,backgroundColor:colors.game.heroLine}} />
     <View style={{position:'absolute',bottom:18,right:'15%',width:75,height:5,borderRadius:8,backgroundColor:colors.game.heroLine}} />
     <Txt variant="hero" style={{textAlign:'center',fontSize:51,lineHeight:56,color:colors.game.accent}}>∴</Txt>
   </View>
   <View style={{gap:S.sm,alignItems:'center'}}><Txt variant="label" style={{letterSpacing:3}}>ИГРА В КРИТИЧЕСКОЕ МЫШЛЕНИЕ</Txt><Txt variant="hero" style={{textAlign:'center'}}>Мания{`\n`}заблуждений</Txt><Txt variant="body" style={{textAlign:'center',color:colors.game.muted}}>Учитесь замечать софизмы и находить их в живом споре</Txt></View>
   <View style={{gap:S.md,marginTop:S.md}}><Action title={game&&!isGameOver(game)?'Продолжить партию':'Новая игра'} onPress={play}/></View>
   {game&&!isGameOver(game)&&<Panel tinted><Txt variant="caption">Сохранённая партия · {game.players.length} игрока(ов) · {formatSeconds(remaining)} · банк {game.bankLeft}/{game.errorBank}</Txt></Panel>}
  </View>;
 } else if(screen==='setup'){
  title='Настройка игры';body=<View style={baseText}>
   <Txt variant="label">УЧАСТНИКИ</Txt>
   {config.players.map((pl,i)=><Panel key={pl.id} style={{gap:S.sm}}>
    <View style={{flexDirection:'row',gap:S.sm,alignItems:'center'}}><View style={{flex:1}}><LineInput label={`Имя игрока ${i+1}`} value={pl.name} onChangeText={name=>updatePlayer(pl.id,{name})}/></View><Action title="×" small tone="outline" disabled={config.players.length<=2} onPress={()=>upd({players:config.players.filter(x=>x.id!==pl.id)})}/></View>
    <View style={{flexDirection:'row',gap:S.sm,flexWrap:'wrap'}}><Chip label="Спорщик" selected={pl.roles.includes('disputant')} onPress={()=>toggleRole(pl.id,'disputant')}/><Chip label="Отгадчик" selected={pl.roles.includes('guesser')} onPress={()=>toggleRole(pl.id,'guesser')}/></View>
   </Panel>)}
   <Action title="+ Добавить игрока" tone="soft" onPress={addPlayer}/>
   <Panel><View style={{flexDirection:'row',flexWrap:'wrap',gap:S.sm,justifyContent:'space-between',alignItems:'center'}}><Txt variant="subtitle">Совмещение ролей</Txt><Chip label={config.dualRoles?'Включено':'Выключено'} selected={config.dualRoles} onPress={()=>{const enabled=!config.dualRoles;if(!enabled)upd({dualRoles:false,players:config.players.map(x=>({...x,roles:x.roles.length>1?['disputant']:x.roles}))});else upd({dualRoles:true})}} /></View><Txt variant="caption">{config.dualRoles?'Игрок может быть спорщиком и угадывать чужие карты.':'У каждого игрока одна роль. Нажмите на другую роль, чтобы переключить её.'}</Txt></Panel>
   <Txt variant="label">НАБОР СОФИЗМОВ</Txt><Panel>
    {PACKS.map(pack=><Pressable accessibilityRole="radio" accessibilityState={{checked:config.packId===pack.id}} key={pack.id} onPress={()=>choosePack(pack.id)} style={{paddingVertical:S.sm,gap:S.xs}}><Txt variant="subtitle">{config.packId===pack.id?'◉':'◯'} {pack.name}</Txt><Txt variant="caption">{pack.description}</Txt></Pressable>)}
    <Txt variant="caption">Выбрано карт: {cfgCardCount}. Сначала выбирается набор, затем можно убрать отдельные софизмы.</Txt>
    <Action title={deckEditor?'Закрыть выбор карт':'Выбрать конкретные софизмы'} tone="soft" onPress={()=>setDeckEditor(v=>!v)}/>
    {deckEditor&&<View style={{gap:S.sm}}>
      <LineInput label="Поиск внутри набора" value={deckQuery} onChangeText={setDeckQuery} placeholder="Название софизма"/>
      <View style={{flexDirection:'row',gap:S.sm}}><Action title="Все" tone="outline" small style={{flex:1}} onPress={()=>upd({selectedIds:deckOptions.slice()})}/><Action title="Ни одного" tone="outline" small style={{flex:1}} onPress={()=>upd({selectedIds:[]})}/></View>
      {deckItems.map(c=><Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{checked:config.selectedIds.includes(c.id)}} onPress={()=>toggleId(c.id)} style={{flexDirection:'row',alignItems:'center',minHeight:48,gap:S.sm,borderBottomWidth:1,borderColor:colors.game.line}}><Text style={{color:colors.game.accent,fontSize:23}}>{config.selectedIds.includes(c.id)?'☑':'□'}</Text><Txt style={{flex:1}}>{c.name}</Txt></Pressable>)}
    </View>}
   </Panel>
   <Txt variant="label">ПРАВИЛА ПАРТИИ</Txt><Panel><LineInput label="Таймер, минут (1–99)" value={config.duration} onChangeText={s=>upd({duration:s.replace(/\D/g,'').slice(0,2)})} keyboardType="number-pad"/><LineInput label="Банк бесплатных ошибок (0–999)" value={config.errorBank} onChangeText={s=>upd({errorBank:s.replace(/\D/g,'').slice(0,3)})} keyboardType="number-pad"/><LineInput label="Тайных карт у каждого спорщика (1–8)" value={config.activePerDisputant} onChangeText={s=>upd({activePerDisputant:s.replace(/\D/g,'').slice(0,1)})} keyboardType="number-pad"/></Panel>
   <Txt variant="caption">Верный ответ: +1. Ошибки сначала тратят общий банк, после его исчерпания каждая ошибка: −1. Значения и состав карт сохраняются локально.</Txt>
  </View>;footer=<Action title="Начать партию" onPress={launch}/>;
 } else if(screen==='handoff'){
  title=reveal?.kind==='review'?'Приватный просмотр':'Тайная выдача';body=<View style={{gap:S.xl,alignItems:'center',paddingTop:S.xxl}}><Txt variant="label">ПЕРЕДАЧА ТЕЛЕФОНА</Txt><View style={{height:116,width:116,borderRadius:58,backgroundColor:colors.game.accentSoft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:56,color:colors.game.accent}}>♧</Text></View><Txt variant="title" style={{textAlign:'center'}}>Передайте телефон{`\n`}{currentSpy?.name||'спорщику'}</Txt><Txt style={{textAlign:'center'}}>Только этот игрок должен видеть свои тайные софизмы.</Txt></View>;
  footer=<Action title={`Я — ${currentSpy?.name||'спорщик'}`} onPress={()=>{setSecretOpen(false);setScreen('secret')}}/>;
 } else if(screen==='secret'){
  title='Тайные карты';body=<View style={baseText}>
    <Txt variant="label">ТОЛЬКО ДЛЯ {currentSpy?.name?.toLocaleUpperCase('ru')}</Txt>
    {!secretOpen?<Panel tinted style={{paddingVertical:S.xxl,alignItems:'center'}}><Txt variant="title">Ваши софизмы скрыты</Txt><Txt variant="caption" style={{textAlign:'center'}}>Убедитесь, что никто не смотрит на экран.</Txt><Action title="Открыть мои карты" onPress={()=>setSecretOpen(true)}/></Panel>:<>
    {revealIds.length===0&&<Txt variant="caption">У вас пока нет тайных карт.</Txt>}
    {revealIds.map((id,i)=>{
     const card=getCard(id);
     const isNew=id===newCardId;
     const backgroundColor=isNew?colors.game.success:colors.game.accent;
     return <Panel key={id} style={{backgroundColor,padding:S.lg}}>
      <Txt variant="label" style={{color:isNew?colors.game.contrast:colors.game.secretEyebrow}}>{isNew?(reveal.repeatCard?'КАРТА ВЫДАНА ПОВТОРНО':'НОВЫЙ СОФИЗМ'):`КАРТА ${i+1}`}</Txt>
      <Txt variant="title" style={{color:colors.game.contrast}}>{card.name}</Txt>
      <Txt style={{color:colors.game.contrast}}>{card.description}</Txt>
      <Txt variant="caption" style={{color:colors.game.secretBody}}>{card.example}</Txt>
      <Action title="Заменить слишком сложный софизм" tone="soft" small onPress={()=>swapSecret(id)}/>
     </Panel>;
    })}
    </>}
  </View>;footer=<Action title="Скрыть карты и продолжить" onPress={finishHandoff}/>;
 } else if(screen==='catalog'){
  title='Игра';body=<View style={baseText}>
   <Panel tinted><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:S.md}}><View><Txt variant="label">{timerRunning?'ПАРТИЯ ИДЁТ':'ПАУЗА'}</Txt><Txt variant="hero" style={{fontVariant:['tabular-nums']}}>{formatSeconds(remaining)}</Txt></View><View style={{alignItems:'flex-end',gap:S.xs}}><Txt variant="caption">Банк ошибок</Txt><Txt variant="subtitle">{game?.bankLeft} / {game?.errorBank}</Txt></View></View>
   <View style={{flexDirection:'row',gap:S.sm}}><Action small style={{flex:1}} title={timerRunning?'Пауза':'Продолжить'} tone="outline" onPress={timerRunning?pause:resume}/><Action small style={{flex:1}} title="Завершить" tone="outline" onPress={()=>ask('Завершить партию?','Текущий счёт сохранится. Результаты откроются сразу.',()=>stop('manual'),'Завершить')}/></View>
   <Txt variant="caption">Активных тайных карт: {activeCount(game)} · Успешных догадок: {game?.history.filter(h=>h.type==='guess'&&h.correct).length||0}</Txt>
   </Panel>
   <Txt variant="title">Какой софизм звучит?</Txt><Txt variant="caption">Откройте приём, который заметили во время спора. Неверные попытки не раскрывают секреты.</Txt>
   {included.map((c,i)=><Pressable accessibilityRole="button" key={c.id} onPress={()=>{setSelectedCard(c.id);setScreen('card')}} style={({pressed})=>({opacity:pressed?.72:1})}><Panel><View style={{flexDirection:'row',gap:S.md}}><Text style={{fontSize:14,color:colors.game.accent,fontWeight:'800'}}>{format(i+1)}</Text><View style={{flex:1,gap:S.xs}}><Txt variant="subtitle">{c.name}</Txt><Txt variant="caption">{preview(c.description,160)}</Txt></View><Text style={{fontSize:23,color:colors.game.accent}}>›</Text></View></Panel></Pressable>)}
  </View>;footer=<Action title="Посмотреть тайные карты" tone="soft" onPress={()=>setScreen('review')}/>;
 } else if(screen==='card'){
  const c=getCard(selectedCard);title='Карточка софизма';body=c&&<View style={baseText}><Txt variant="label">СОФИЗМ · {c.id}</Txt><Panel tinted><Txt variant="title">{c.name}</Txt><Txt>{c.description}</Txt></Panel><Panel><Txt variant="label">ПРИМЕР</Txt><Txt>{c.example}</Txt></Panel><Panel><Txt variant="label">КАК РАСПОЗНАТЬ</Txt><Txt>{c.explanation}</Txt></Panel></View>;footer=<Action title="Я заметил этот софизм · Угадать" onPress={()=>openGuess(c.id)}/>;
 } else if(screen==='review'){
  title='Чьи карты показать?';
  body=<View style={baseText}>
   <Txt>Выберите спорщика и передайте ему телефон.</Txt>
   {gameDisputants.map(pl=><Action key={pl.id} title={pl.name} tone="outline" onPress={()=>reviewCards(pl.id)}/>)}
  </View>;
 } else if(screen==='end'){
  title='Итоги партии';const ranking=game?standings(game):[];body=<View style={baseText}><Txt variant="label">{game?.finishedReason==='timer'?'ВРЕМЯ ИСТЕКЛО':'ПАРТИЯ ЗАВЕРШЕНА'}</Txt><Txt variant="title">Результаты отгадчиков</Txt><Panel tinted><Txt>Верно: +1 · Ошибка после исчерпания общего банка: −1. Начальный банк: {game?.errorBank}; осталось: {game?.bankLeft}.</Txt></Panel>
   {ranking.map((r,i)=><Panel key={r.id}><View style={{flexDirection:'row',justifyContent:'space-between'}}><View><Txt variant="caption">Место {i+1}</Txt><Txt variant="subtitle">{r.name}</Txt></View><Txt variant="hero" style={{fontVariant:['tabular-nums']}}>{r.score>0?'+':''}{r.score}</Txt></View><Txt variant="caption">Правильно: {r.right} · Ошибки: {r.wrong}</Txt></Panel>)}
   <Accordion title="Статистика спорщиков" theme="game">{disputants(game).map(x=><Txt key={x.id}>{x.name}: угадано {game.stats[x.id].solved}, добровольно заменено {game.stats[x.id].discarded}</Txt>)}</Accordion>
   <Accordion title="История партии" theme="game">{[...game.history].reverse().map((h,i)=><Txt key={i} variant="caption" theme="game">{h.type==='guess'?`${getPlayer(game,h.guesserId)?.name}: ${h.correct?'✓':'×'} ${getCard(h.cardId)?.name} → ${getPlayer(game,h.disputantId)?.name}; ${h.scoreDelta>0?'+':''}${h.scoreDelta} очков, банк ${h.bankDelta}`:`Сброс: ${getPlayer(game,h.disputantId)?.name} · ${getCard(h.cardId)?.name}`}</Txt>)}</Accordion>
  </View>;footer=<View style={{gap:S.sm}}><Action title="Новая игра" onPress={newGame}/><Action title="В главное меню" tone="outline" onPress={navigateHome}/></View>;
 } else if(screen==='rules'){
  title='Правила игры';body=<View style={baseText}><Txt variant="title">Играйте и учитесь спорить</Txt>
   <Panel><Txt variant="subtitle">1. Тайная раздача</Txt><Txt>Спорщики получают по три скрытые карты (количество настраивается). Один и тот же софизм не выдаётся одновременно разным спорщикам.</Txt></Panel>
   <Panel><Txt variant="subtitle">2. Ищите ошибку</Txt><Txt>Отгадчики замечают софизм в живом споре, выбирают соответствующую карточку, затем отгадчика и спорщика. Приложение проверяет только наличие карты, а не речь.</Txt></Panel>
   <Panel><Txt variant="subtitle">3. Очки и банк ошибок</Txt><Txt>Правильная догадка даёт +1 очко. При неправильной попытке сначала расходуется общий банк ошибок (20 по умолчанию). Когда он пуст, каждое неправильное угадывание приносит −1 очко соответствующему отгадчику. Баллы могут стать отрицательными.</Txt></Panel>
   <Panel><Txt variant="subtitle">4. Новые карты</Txt><Txt>Правильно угаданный софизм уходит в сброс; спорщик видит новый. Спорщик может сам заменить слишком сложную карту. После исчерпания колоды сброшенные карты снова доступны.</Txt></Panel>
   <Panel><Txt variant="subtitle">5. Завершение</Txt><Txt>Общий таймер по умолчанию составляет 20 минут. Его можно поставить на паузу, а партию — завершить досрочно. Итоги и история действий сохраняются локально.</Txt></Panel>
   <Action title={game&&!isGameOver(game)?'Продолжить партию':'Играть'} onPress={play}/>
  </View>;
 } else if(screen==='read'){
  title='Библиотека софизмов';body=<View style={baseText}>
   <View style={{paddingVertical:S.sm,gap:S.sm}}><Txt theme="read" variant="label">АРХИВ КРИТИЧЕСКОГО МЫШЛЕНИЯ</Txt><Txt theme="read" variant="title" style={{fontSize:30}}>Библиотека софизмов</Txt><Txt theme="read" variant="caption">{CARDS.length} статей · расширенные разборы и краткие карточки</Txt></View>
   <LineInput theme="read" label="Поиск по названию и содержанию" placeholder="Например, ложная дилемма" value={readingSearch} onChangeText={setReadingSearch}/>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:S.sm}}><Chip theme="read" label="Все" selected={readingFilter==='all'} onPress={()=>setReadingFilter('all')}/><Chip theme="read" label="Начальные" selected={readingFilter==='basic'} onPress={()=>setReadingFilter('basic')}/><Chip theme="read" label="Продвинутые" selected={readingFilter==='advanced'} onPress={()=>setReadingFilter('advanced')}/></View>
   {readItems.length===0?<Panel theme="read"><Txt theme="read">Ничего не найдено. Измените запрос или сбросьте фильтр.</Txt><Action theme="read" title="Сбросить поиск" onPress={()=>{setReadingFilter('all');setReadingSearch('')}}/></Panel>:readItems.map((c,i)=><Pressable key={c.id} accessibilityRole="button" onPress={()=>readCard(c.id)}><Panel theme="read" style={{gap:S.sm}}><Txt variant="caption" theme="read">{format(i+1)} · {c.difficulty==='basic'?'ОСНОВЫ':'РАСШИРЕННЫЙ НАБОР'}{hasFullArticle(c.id)?' · ПОЛНЫЙ РАЗБОР':''}</Txt><Txt variant="subtitle" theme="read">{c.name}  ›</Txt><Txt variant="caption" theme="read">{preview(c.description,170)}</Txt></Panel></Pressable>)}
  </View>;
 } else if(screen==='article'&&readingArticle){
  title=readingArticle.name;body=<View style={baseText}>
   <Txt variant="label" theme="read">БИБЛИОТЕКА / {readingArticle.id}</Txt><Txt theme="read" variant="title" style={{fontSize:30}}>{readingArticle.name}</Txt>
   <Panel theme="read" tinted><Txt theme="read">{readingArticle.intro}</Txt></Panel>
   {!readingArticle.full&&<Txt theme="read" variant="caption">Краткий материал из набора карточек. Полная историческая статья для этой темы пока не перенесена.</Txt>}
   {readingArticle.sections.map((s,i)=><Accordion key={i} title={s.title} theme="read" startOpen={i===0} onLayout={e=>{articleSectionY.current[i]=e.nativeEvent.layout.y}} onCollapse={()=>returnToSection(i)}>{displaySectionParagraphs(s).map((x,j)=><Txt theme="read" key={j}>{x}</Txt>)}</Accordion>)}
   {readingArticle.quizzes?.length>0&&<Panel theme="read" tinted><Txt theme="read" variant="subtitle">Проверь себя</Txt><Txt theme="read" variant="caption">{readingArticle.quizzes.length} вопросов · результаты сохраняются в разделе «Тесты».</Txt><Action theme="read" title="Пройти тест по теме" onPress={()=>openTests(readingArticle.id)}/></Panel>}
   <Txt theme="read" variant="label">СХОЖИЕ И СВЯЗАННЫЕ ТЕМЫ</Txt><View style={{flexDirection:'row',flexWrap:'wrap',gap:S.sm}}>{getRelated(currentArticle).map(x=><Chip key={x.id} theme="read" label={`${x.name} ↗`} onPress={()=>{setCurrentArticle(x.id);setScreen('article')}} />)}</View>
  </View>;
 }
 if(screen==='tests')body=<QuizSection initialLessonId={testLesson} onHome={()=>setScreen('home')} onRead={readCard} onStageChange={setTestsStage}/>;
 const header=['home','tests'].includes(screen)?null:<Topbar title={title||'Софизмы'} theme={theme} onBack={()=>onBack()}/>;
 const content=screen==='tests'?body:<ScrollView style={{flex:1}} ref={screen==='article'?articleScrollRef:undefined} key={screen==='article'?`article-${currentArticle}`:screen} keyboardShouldPersistTaps="handled" contentContainerStyle={screen==='home'?{flexGrow:1}:[blockPadding,{paddingBottom:footer?S.lg:S.xxl}]}>
  {body}{scrollFooter&&footer}
 </ScrollView>;
 return <SafeAreaView style={{flex:1,backgroundColor:p.bg}} edges={['top','bottom']}>
   <StatusBar backgroundColor={p.bg} barStyle="dark-content"/>
   {header}{content}
   {footer&&!scrollFooter&&<View style={{padding:S.md,borderTopWidth:1,borderColor:p.line,backgroundColor:p.bg}}>{footer}</View>}
   {(['home','rules','read','article'].includes(screen)||(screen==='tests'&&['catalog','history'].includes(testsStage)))&&<Nav active={screen==='article'?'read':screen} onHome={navigateHome} onRead={()=>setScreen('read')} onTests={()=>openTests()} onRules={()=>setScreen('rules')}/>}
   {savingError&&<View style={{position:'absolute',top:0,left:0,right:0,backgroundColor:'#FFF0E0',padding:S.sm}}><Txt variant="caption">Не удалось сохранить данные. Проверьте свободное место.</Txt></View>}
   {overlay?.type==='guess'?<Overlay entry={{title:'Проверка догадки',description:`Софизм: ${getCard(selectedCard)?.name||''}`,cancel:'Отмена',confirm:'Проверить',onConfirm:doGuess,confirmDisabled:!canCheckGuess,
     extra:<View style={{gap:S.md}}>
      <View style={{gap:S.sm}}>
       <Txt variant="label">КТО УГАДЫВАЕТ?</Txt>
       <View style={{flexDirection:'row',flexWrap:'wrap',gap:S.sm}}>{eligibleGuessers.map(pl=><Chip key={pl.id} label={pl.name} selected={guessWho===pl.id} onPress={()=>selectGuesser(pl.id)}/>)}</View>
      </View>
      <View style={{gap:S.sm}}>
       <Txt variant="label">КТО СКАЗАЛ СОФИЗМ?</Txt>
       <View style={{flexDirection:'row',flexWrap:'wrap',gap:S.sm}}>{guessTargets.map(pl=><Chip key={pl.id} label={pl.name} selected={guessTarget===pl.id} onPress={()=>setGuessTarget(pl.id)}/>)}</View>
      </View>
     </View>
   }} theme="game" onDismiss={closeOverlay}/>:<Overlay entry={overlay} theme={theme} onDismiss={closeOverlay}/>}
 </SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><AppInner/></SafeAreaProvider>}
