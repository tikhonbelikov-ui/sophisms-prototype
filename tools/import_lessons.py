#!/usr/bin/env python3
"""Build all canonical UTF-8 lessons for offline use. No network required."""
import hashlib
import json
import re
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
TAGS=re.compile(r'(?m)^\s*#(MSG(?:\s+\[[^\]]+\])?|QUIZ|ON_CORRECT|END)\s*$')
NUMBER=re.compile(r'^\s*\d+[.)]\s*')
ANSWER_LABELS=['Разбираемый софизм','Не является софизмом (корректная аргументация)','Другой софизм']
SHORT_DEFINITIONS=json.loads((ROOT/"tools"/"short_definitions.json").read_text(encoding="utf8"))
TARGET_ALIASES={
    'SOF-019':['Отвлекающий манёвр'], 'SOF-031':['А сам какой?'],
    'SOF-033':['Специальные требования'], 'SOF-034':['Апелляция к последствию'],
    'SOF-042':['Апелляция к кошельку / социальной неуспешности'],
    'SOF-047':['Высмеивание'], 'SOF-068':['Предвзятость враждебной атрибуции'],
}
def label_norm(t):
    return re.sub(r'[^а-яa-z0-9]','',re.sub(r'\([^)]*\)','',t.lower().replace('ё','е')))
def normalize_quiz(q,ident,name,filename):
    target={label_norm(x) for x in [name,Path(filename).stem.replace('_',' ')]+TARGET_ALIASES.get(ident,[])}
    answer=next(x['text'] for x in q['answers'] if x['correct'])
    low=answer.lower()
    if low.startswith(('не является','корректная')):kind=1
    elif low.startswith('друг'):kind=2
    elif low.startswith('разбираем') or label_norm(answer) in target:kind=0
    else:kind=2 # A specifically named different fallacy, e.g. hasty generalization.
    return {**q,'answers':[{'text':text,'correct':i==kind} for i,text in enumerate(ANSWER_LABELS)]}
def paragraphs(t):
    t=re.sub(r'(?im)^(?=[\s*]*(?:концептуальн|реальн|доказательство (?:истинн|ложн)|примеры с (?:истинн|ложн)))', '\n', t)
    return [p.strip() for p in re.split(r'\n\s*\n',t) if p.strip()]
def normalized(t):
    return re.sub(r'\s+','',t)
def parse(path):
    text=path.read_text(encoding='utf-8-sig')
    # Legacy files sometimes place a service tag after the last answer.
    prepared=re.sub(r'(?<!\n)(#ON_CORRECT)\b',r'\n\1\n',text)
    prepared=re.sub(r'(?m)^(#ON_CORRECT)[ \t]+(?=\S)',r'\1\n',prepared)
    parts=TAGS.split(prepared)
    if parts[0].strip():raise ValueError(f'{path.name}: text before first tag')
    blocks=[(parts[i],parts[i+1].strip()) for i in range(1,len(parts),2)]
    messages=[v for k,v in blocks if k.startswith('MSG') and '[ad]' not in k and v]
    if len(messages)<3:raise ValueError(f'{path.name}: fewer than three messages')
    sections=[]
    def add(title,ps):
        if ps:sections.append({'title':title,'paragraphs':ps})
    intro_ps=[];buckets={'concept':[],'real':[]};state='intro'
    for p in paragraphs(messages[0]):
        plain=p.lstrip('*•—- ').lower()
        if re.match(r'(?:другой |второй |еще один |ещё один )?концептуальн|в своей концептуальн',plain):state='concept'
        elif re.match(r'(?:другой |второй )?реальн|историческ|один из .{0,50}реальн|в истории можно найти реальн',plain):state='real'
        (intro_ps if state=='intro' else buckets[state]).append(p)
    intro='\n\n'.join(intro_ps)
    add('Концептуальные примеры',buckets['concept'])
    add('Реальные примеры',buckets['real'])
    middle=paragraphs(messages[1])
    split_at=next((i for i,p in enumerate(middle) if re.match(r'(?i)^[\s*•—-]*(?:(?:теперь )?(?:реальный |концептуальный )?(?:примеры?|доказательство)[^:\n]{0,65})?(?:истинн|верн)',p)),None)
    if split_at is None:add('Ложные и истинные утверждения',middle)
    else:
        add('Доказательство ложного утверждения',middle[:split_at])
        add('Истинное утверждение через ошибку',middle[split_at:])
    add('Когда это не ошибка — не софизм',paragraphs(messages[2]))
    for m in messages[3:]:add('Дополнительные пояснения',paragraphs(m))
    displayed=intro+''.join(p for s in sections for p in s['paragraphs'])
    if normalized(displayed)!=normalized(''.join(messages)):raise ValueError(f'{path.name}: lesson text lost')
    quizzes=[];empty=0
    for i,(kind,value) in enumerate(blocks):
        if kind!='QUIZ':continue
        if not value:
            empty+=1
            continue
        lines=[s.strip() for s in value.splitlines() if s.strip()]
        first=next((j for j,s in enumerate(lines) if NUMBER.match(s)),None)
        if first is None:first=len(lines)-4
        question='\n'.join(lines[:first])
        answers=[{'text':re.sub(r'\*\s*$','',NUMBER.sub('',s)).strip(),'correct':s.endswith('*')} for s in lines[first:]]
        explanation=blocks[i+1][1] if i+1<len(blocks) and blocks[i+1][0]=='ON_CORRECT' else ''
        if not question or len(answers) not in (3,4) or sum(a['correct'] for a in answers)!=1:raise ValueError(f'{path.name}: malformed quiz {len(quizzes)+1}')
        if not explanation:
            # Preserve a legacy question whose source contains no explanation.
            explanation='Правильный ответ: '+next(a['text'] for a in answers if a['correct'])+'.'
        quizzes.append({'question':question,'answers':answers,'explanation':explanation})
    return {'intro':intro,'sections':sections,'quizzes':quizzes},empty
def tidy_example_section(section):
    """Remove redundant section heads/credibility labels; numbering belongs to the reader UI."""
    if section['title'] not in ('Концептуальные примеры', 'Реальные примеры'):
        return section
    cleaned = []
    for paragraph in section['paragraphs']:
        p=paragraph.strip()
        p=re.sub(r'^(?:\*{1,2})?(?:Концептуальные|Реальные)(?: исторические)? примеры(?: \(с высокой степенью достоверности\))?(?: с высокой степенью достоверности)?\s*:\s*(?:\*{1,2})?', '', p, flags=re.I).strip()
        p=re.sub(r'^(?:Первый|Второй|Третий|Четвёртый|Пятый)\s+(?:концептуальный|реальный|исторический)\s+пример\s*[:—–-]\s*', '', p, flags=re.I).strip()
        p=re.sub(r'^Концептуальный пример\s*[:—–-]\s*', '', p, flags=re.I).strip()
        p=re.sub(r'^Реальный пример с высокой(?: степенью)? достоверност(?:ью|и)\s*[:—–-]\s*', '', p, flags=re.I).strip()
        p=re.sub(r'^Реальным(?: историческим)? примером с высокой(?: степенью)? достоверност(?:ью|и)\s+(?:служит|служат|является|являются|был|были)\s+', '', p, flags=re.I).strip()
        p=re.sub(r'^Реальный пример с высокой(?: степенью)? достоверност(?:ью|и)\s+(?:—|-|:)\s*', '', p, flags=re.I).strip()
        p=re.sub(r'^Реальные(?: исторические)? примеры[^:\n]{0,100}достоверност(?:ью|и)\s*:\s*', '', p, flags=re.I).strip()
        if p:
            if p[0].islower():p=p[0].upper()+p[1:]
            cleaned.append(p)
    return {**section,'paragraphs':cleaned}

def excerpt(text, max_chars=480):
    """Fallback card preview only; complete text stays in the article."""
    if len(text)<=max_chars:return text
    words=text[:max_chars+1].rsplit(' ',1)
    prefix=words[0].rstrip(' ,;:-—–.\n') if len(words)>1 else text[:max_chars].rstrip(' ,;:-—–.\n')
    return prefix+'…'

def run(source):
    names=json.loads((DATA/'canonical63.json').read_text('utf8'))
    ids=json.loads((DATA/'pack63.json').read_text('utf8'))
    catalog=json.loads((DATA/'catalog.json').read_text('utf8'));cards={c['id']:c for c in catalog}
    articles_dir=DATA/'articles';articles_dir.mkdir(exist_ok=True)
    index={};rows=[]
    for name,ident in zip(names,ids,strict=True):
        path=source/name;article,empty=parse(path);article.update(id=ident,name=cards[ident]['name'])
        source_four=sum(len(q['answers'])==4 for q in article['quizzes'])
        article['quizzes']=[normalize_quiz(q,ident,article['name'],name) for q in article['quizzes']]
        article['sections']=[tidy_example_section(section) for section in article['sections']]
        first_example=next((s['paragraphs'][0] for s in article['sections'] if s['title']=='Концептуальные примеры'),article['intro'])
        if cards[ident].pop('needs_source_lesson',False) or cards[ident]['explanation'].startswith('Подробнее'):
            cards[ident]['description']=SHORT_DEFINITIONS.get(ident,excerpt(re.sub(r'\*','',article['intro'].split('\n\n')[-1]),240))
            cards[ident]['example']=excerpt(re.sub(r'\*','',first_example))
            cards[ident]['explanation']='Полное объяснение и границы применения доступны в библиотеке.'
        if ident in SHORT_DEFINITIONS:
            cards[ident]['description']=SHORT_DEFINITIONS[ident]
            card_example=next((section['paragraphs'][0] for section in article['sections'] if section['title']=='Концептуальные примеры' and section['paragraphs']),article['intro'])
            cards[ident]['example']=excerpt(re.sub(r'\*','',card_example))
        encoded=json.dumps(article,ensure_ascii=False,separators=(',',':'))+'\n'
        (articles_dir/(ident+'.json')).write_text(encoded,encoding='utf8')
        index[ident]={'name':article['name'],'quizCount':len(article['quizzes'])}
        raw=path.read_bytes()
        rows.append({'file':name,'id':ident,'sourceBytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'quizzes':len(article['quizzes']),'sourceFourOptionQuestions':source_four,'emptyQuizMarkers':empty,'articleBytes':len(encoded.encode('utf8'))})
    (DATA/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    (DATA/'article_index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    loaders='// Generated. Static require paths let Metro include every offline article.\nmodule.exports = {\n'
    loaders+=''.join(f"  '{ident}': () => require('./articles/{ident}.json'),\n" for ident in ids)
    (DATA/'article_loaders.js').write_text(loaders+'};\n',encoding='utf8')
    (ROOT/'CONTENT_MANIFEST.json').write_text(json.dumps({'lessons':len(rows),'quizzes':sum(r['quizzes'] for r in rows),'files':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f"Built {len(rows)} offline lessons, {sum(r['quizzes'] for r in rows)} complete quizzes; empty duplicate markers: {sum(r['emptyQuizMarkers'] for r in rows)}")
    return rows
if __name__=='__main__':
    run(Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'source_lessons')
