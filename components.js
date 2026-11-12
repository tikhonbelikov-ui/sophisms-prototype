import React,{useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View,useWindowDimensions} from 'react-native';
const {colors,spacing:S,radius:R,type:Ty}=require('./theme');

function Txt({children,variant='body',theme='game',style,numberOfLines,...rest}){
 const p=colors[theme]; const presets={body:{fontSize:Ty.body,lineHeight:24,color:p.ink},caption:{fontSize:Ty.caption,lineHeight:20,color:p.muted},label:{fontSize:Ty.eyebrow,fontWeight:'800',letterSpacing:1.1,color:p.accent},title:{fontSize:Ty.heading,fontWeight:'800',lineHeight:31,color:p.ink},subtitle:{fontSize:Ty.sub,fontWeight:'700',color:p.ink},hero:{fontSize:Ty.hero,lineHeight:39,fontWeight:'800',color:p.ink}};
 return <Text numberOfLines={numberOfLines} selectable={variant==='body'} {...rest} style={[presets[variant],theme==='read'&&['title','subtitle','hero'].includes(variant)?{fontFamily:'serif'}:null,style]}>{children}</Text>;
}
function Action({title,onPress,theme='game',tone='primary',disabled=false,style,small=false}){
 const p=colors[theme];const fill=tone==='primary'?p.accent:tone==='soft'?p.surfaceAlt:p.surface;
 const ink=tone==='primary'?p.contrast:p.accent;
 return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled}} onPress={onPress} disabled={disabled} style={({pressed})=>[{
  borderRadius:R.md,borderCurve:'continuous',minHeight:small?48:52,paddingHorizontal:small?12:18,paddingVertical:small?9:13,justifyContent:'center',alignItems:'center',backgroundColor:fill,borderWidth:tone==='outline'?1:0,borderColor:p.line,opacity:disabled?.45:pressed?.78:1},style]}>
  <Text style={{fontSize:small?14:16,fontWeight:'700',color:ink,textAlign:'center'}}>{title}</Text>
 </Pressable>;
}
function Panel({children,theme='game',style,tinted=false}){const p=colors[theme];return <View style={[{backgroundColor:tinted?p.surfaceAlt:p.surface,borderColor:p.line,borderWidth:1,borderRadius:R.lg,borderCurve:'continuous',padding:S.base,gap:S.sm},style]}>{children}</View>;}
function Topbar({title,onBack,theme}){const p=colors[theme];return <View style={{paddingHorizontal:S.base,paddingTop:S.sm,paddingBottom:S.md,flexDirection:'row',alignItems:'center',gap:S.md,borderBottomColor:p.line,borderBottomWidth:1}}>
 <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={onBack} style={{width:48,height:48,borderRadius:R.md,backgroundColor:p.surface,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:p.line}}><Text style={{fontSize:28,color:p.accent,lineHeight:32}}>‹</Text></Pressable>
 <Txt theme={theme} variant="subtitle" numberOfLines={1} style={{flex:1}}>{title}</Txt>
 </View>;}
function Chip({label,selected,onPress,theme='game',style}){const p=colors[theme];return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={({pressed})=>[{borderRadius:R.full,borderColor:selected?p.accent:p.line,borderWidth:1,backgroundColor:selected?p.accentSoft:p.surface,paddingHorizontal:13,paddingVertical:S.xs,minHeight:48,maxWidth:'100%',justifyContent:'center',opacity:pressed?.75:1},style]}><Text style={{color:p.ink,fontWeight:selected?'800':'600',fontSize:14}}>{label}</Text></Pressable>;}
function LineInput({value,onChangeText,label,theme='game',keyboardType='default',placeholder,style}){const p=colors[theme];return <View style={[{gap:S.xs},style]}><Txt theme={theme} variant="caption">{label}</Txt><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={p.muted} keyboardType={keyboardType} style={{fontSize:16,color:p.ink,backgroundColor:p.surface,borderWidth:1,borderColor:p.line,borderRadius:R.md,minHeight:50,paddingHorizontal:S.md}} /></View>;}
function Accordion({title,children,theme='read',startOpen=false,onCollapse,onLayout}){const [opened,setOpened]=useState(startOpen);const p=colors[theme];const toggle=()=>{if(opened)onCollapse?.();setOpened(x=>!x)};return <View onLayout={onLayout} style={{borderWidth:1,borderColor:p.line,borderRadius:R.md,backgroundColor:p.surface,overflow:'hidden'}}>
 <Pressable accessibilityRole="button" accessibilityState={{expanded:opened}} onPress={toggle} style={{padding:S.base,minHeight:56,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:S.sm}}>
 <Txt theme={theme} variant="subtitle" style={{flex:1,fontSize:17}}>{title}</Txt><Text style={{color:p.accent,fontSize:20}}>{opened?'⌃':'⌄'}</Text>
 </Pressable>{opened&&<View style={{padding:S.base,paddingTop:0,borderTopWidth:1,borderColor:p.line,gap:S.md}}>{children}
  <Pressable accessibilityRole="button" accessibilityLabel={`Свернуть раздел «${title}»`} onPress={toggle} style={({pressed})=>({marginTop:S.xs,alignSelf:'flex-end',paddingHorizontal:S.md,paddingVertical:S.sm,borderRadius:R.md,flexDirection:'row',gap:S.sm,alignItems:'center',backgroundColor:p.surfaceAlt,opacity:pressed?.72:1})}>
   <Text style={{color:p.accent,fontSize:19,fontWeight:'700'}}>⌃</Text><Text style={{color:p.accent,fontSize:14,fontWeight:'700'}}>Свернуть раздел</Text>
  </Pressable>
 </View>}</View>}
function Overlay({entry,theme,onDismiss}){
 const {width,height,fontScale}=useWindowDimensions();
 if(!entry)return null;
 const p=colors[theme];
 const inset=width<380?S.sm:S.base;
 const scrollActions=height<320||fontScale>=1.8;
 const actions=<View style={{flexDirection:'row',gap:S.sm,justifyContent:'flex-end',padding:S.md,borderTopWidth:1,borderColor:p.line}}>
  {entry.cancel&&<Action title={entry.cancel} theme={theme} tone="outline" small onPress={onDismiss} style={{flex:1,minWidth:0}}/>}
  <Action title={entry.confirm||'Хорошо'} theme={theme} small disabled={entry.confirmDisabled} onPress={entry.onConfirm||onDismiss} style={{flex:1,minWidth:0}}/>
 </View>;
 return <View accessibilityViewIsModal style={{position:'absolute',left:0,right:0,top:0,bottom:0,justifyContent:'center',alignItems:'center',padding:inset,backgroundColor:p.overlay,zIndex:20}}>
  <View style={{width:'100%',maxWidth:560,maxHeight:'100%',flexShrink:1,backgroundColor:p.surface,borderRadius:R.lg,borderWidth:1,borderColor:p.line,overflow:'hidden'}}>
   <ScrollView keyboardShouldPersistTaps="handled" style={{flexGrow:0,flexShrink:1}}>
    <View style={{padding:S.base,gap:S.md}}>
     <Txt variant="title" theme={theme}>{entry.title}</Txt>
     {entry.description?<Txt theme={theme}>{entry.description}</Txt>:null}
     {entry.extra}
    </View>
    {scrollActions&&actions}
   </ScrollView>
   {!scrollActions&&actions}
  </View>
 </View>;
}

export {Txt,Action,Panel,Topbar,Chip,LineInput,Accordion,Overlay};
