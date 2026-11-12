#!/usr/bin/env python3
"""Download the 63 originals from user's GitHub repo with gh CLI, then import offline articles.
Requires authenticated gh auth login with read access to Claud-s_book.
Run before Expo build: python tools/download_lessons.py
"""
import base64, json, pathlib, subprocess, sys, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]; DATA=ROOT/'data'
SRC=ROOT/'source_lessons';SRC.mkdir(exist_ok=True)
REPO='joneon56-arch/Claud-s_book'
PREFIX='Создание_книг/Когнитивные_искажения'
names=json.loads((DATA/'canonical63.json').read_text('utf8'))
# manifest retains exact source filenames for audit.
for i,name in enumerate(names,1):
    target=SRC/name
    if target.exists() and target.stat().st_size>500:
        print(f'[{i}/63] Уже есть {name}',flush=True);continue
    url='repos/'+REPO+'/contents/'+urllib.parse.quote(PREFIX+'/'+name,safe='/')
    try:
        data=json.loads(subprocess.check_output(['gh','api',url],stderr=subprocess.PIPE).decode('utf8'))
        txt=base64.b64decode(data['content']).decode('utf-8-sig')
        if not all(token in txt for token in ['#MSG','#QUIZ','#END']):raise RuntimeError('Unexpected lesson format')
        target.write_text(txt,encoding='utf8')
        print(f'[{i}/63] Скачано {name}',flush=True)
    except Exception as e:
        print(f'ОШИБКА [{i}/63] {name}: {e}',file=sys.stderr)
        raise SystemExit('Полный импорт не выполнен. Проверьте gh auth status и доступ к репозиторию.')
subprocess.run([sys.executable,str(ROOT/'tools'/'import_lessons.py'),str(SRC)],check=True)
# store raw original sources so no network is needed after APK build
print('Все 63 TXT сохранены в source_lessons/ и преобразованы в data/articles/.')
