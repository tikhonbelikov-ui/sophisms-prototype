#!/usr/bin/env python3
"""Add a canonical, non-duplicating 63-topic pack; automatically installed after importing lessons."""
import json, pathlib, re, unicodedata
R=pathlib.Path(__file__).resolve().parents[1]; D=R/'data'
CANONICAL='''Апелляция_к_авторитету Апелляция_к_бедности Апелляция_к_богатству Апелляция_к_большинству Апелляция_к_высмеиванию Апелляция_к_жалости Апелляция_к_последствиям Апелляция_к_природе Апелляция_к_новизне Апелляция_к_силе Апелляция_к_сложности Апелляция_к_социальной_неуспешности Апелляция_к_традиции Апелляция_к_эмоциям Апелляция_к_незнанию Перекладывание_бремени_доказательства Соломенное_чучело Переход_на_личности Отвлекающий_манёвр Отравление_колодца Круговая_аргументация Генетическая_ошибка А_сам_такой Ложная_аналогия Корреляция_не_равна_причинности После_этого_значит_по_причине_этого Ошибка_единственной_причины Ошибка_игрока Иллюзорная_корреляция Ошибка_выжившего Ошибка_невозвратных_затрат Ошибка_композиции Ошибка_деления Категориальная_ошибка Ложная_дилемма Ошибка_нирваны Скользкий_путь Специальные_требования Аргумент_от_анекдота Эффект_якоря Эффект_первенства Эффект_недавности Эффект_простого_предъявления Фрейминг_эффект Эвристика_доступности Эвристика_репрезентативности Фундаментальная_ошибка_атрибуции Предвзятость_самообслуживания Ошибка_злого_умысла Наивный_реализм Слепое_пятно_предвзятости Иллюзия_контроля Иллюзия_справедливого_мира Предвзятость_статус_кво Ошибка_планирования Склонность_к_подтверждению Эффект_Барнума Эффект_ложного_консенсуса Иллюзия_прозрачности Эффект_ореола Эффект_Даннинга_Крюгера Псевдоглубина Ошибка_меткого_стрелка'''.split()
assert len(CANONICAL)==63
ALIAS={
'Соломенное_чучело':'SOF-003','Переход_на_личности':'SOF-002','Отвлекающий_манёвр':'SOF-019','Круговая_аргументация':'SOF-017','А_сам_такой':'SOF-031','Скользкий_путь':'SOF-015','Специальные_требования':'SOF-033','Ошибка_меткого_стрелка':'SOF-038','Ошибка_нирваны':'SOF-039',
'После_этого_значит_по_причине_этого':'SOF-012'
}
def norm(x):return ''.join(c for c in unicodedata.normalize('NFKD',x.lower().replace('ё','е')) if c.isalnum() and not unicodedata.combining(c))
def run():
 cards=json.loads((D/'catalog.json').read_text('utf8'))
 originals={c['id']:c for c in cards}; byname={norm(c['name']):c for c in cards}
 # use exact names or explicit vetted aliases; do not mistakenly map two source lessons to one game card
 pack=[];used=set();notes=[]
 next_id=46
 for filebase in CANONICAL:
  name=filebase.replace('_',' ')
  c=originals.get(ALIAS.get(filebase,'')) or byname.get(norm(name))
  if c and c['id'] in used:
   c=None
  if not c:
   while f'SOF-{next_id:03d}' in originals or f'SOF-{next_id:03d}' in used:next_id+=1
   c={'id':f'SOF-{next_id:03d}','name':name,'alternative_name':'',
      'description':f'Разбор «{name}». Полное учебное содержание загружается из исходного урока.',
      'example':'Откройте полный урок в разделе «Читать», чтобы изучить примеры и границы применения.',
      'explanation':'При импорте оригинальных уроков эта карточка получает уточнённое описание.',
      'difficulty':'advanced','existing_in_prototype':False,'needs_source_lesson':True}
   originals[c['id']]=c;byname[norm(name)]=c;notes.append(name)
  pack.append(c['id']);used.add(c['id'])
 # allow all 45 existing game cards to remain available without enlarging the canonical 63-pack
 (D/'catalog.json').write_text(json.dumps(list(originals.values()),ensure_ascii=False,indent=2)+'\n','utf8')
 (D/'pack63.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n','utf8')
 (D/'canonical63.json').write_text(json.dumps([x+'.txt' for x in CANONICAL],ensure_ascii=False,indent=2)+'\n','utf8')
 print('Канонический пак:',len(pack),'уникальных карточек; каталог:',len(originals),'карточек; требуются исходные тексты для',len(notes),'новых карточек')
 return len(notes)
if __name__=='__main__':run()
