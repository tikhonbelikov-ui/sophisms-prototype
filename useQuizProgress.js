import {useEffect,useRef,useState,useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const {createProgressStore,emptyProgress}=require('./quiz');

export function useQuizProgress(){
 const store=useRef(null);if(!store.current)store.current=createProgressStore(AsyncStorage);
 const alive=useRef(true),locked=useRef(false);
 const [progress,setProgress]=useState(emptyProgress);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(null);
 const load=useCallback(async()=>{
  setError(null);setReady(false);
  try{const p=await store.current.load();if(alive.current){setProgress(p);setReady(true);}}
  catch(e){if(alive.current)setError('Не удалось загрузить результаты. Они не будут перезаписаны. Проверьте свободное место и повторите попытку.');}
 },[]);
 useEffect(()=>{alive.current=true;load();return()=>{alive.current=false}},[load]);
 const update=useCallback(async transform=>{
  if(locked.current||!ready)return false;
  locked.current=true;setBusy(true);setError(null);
  try{const p=await store.current.update(transform);if(alive.current)setProgress(p);return p;}
  catch(e){if(alive.current)setError('Не удалось сохранить ответ. Проверьте свободное место и попробуйте ещё раз.');return false;}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 },[ready]);
 return {progress,ready,busy,error,load,update};
}
