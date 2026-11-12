const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const manifest=require('../CONTENT_MANIFEST.json');
const {getArticle,hasFullArticle}=require('../reader');
const {PACKS}=require('../game');

test('все 63 оригинала сохранены и доступны из расширенного пака',()=>{
 const ids=PACKS.find(p=>p.id==='canonical63').ids;
 assert.equal(manifest.lessons,63);
 assert.equal(new Set(manifest.files.map(f=>f.id)).size,63);
 for(const row of manifest.files){
  const raw=fs.readFileSync(path.join(root,'source_lessons',row.file));
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),row.sha256,row.file);
  assert(ids.includes(row.id),row.id);
  assert(hasFullArticle(row.id),row.id);
  const a=getArticle(row.id);
  assert(a.full&&a.intro&&a.sections.length>0,row.id);
  assert.equal(a.quizzes.length,row.quizzes,row.id);
 }
});

test('все 991 непустых вопроса имеют варианты, ключ и пояснение',()=>{
 let total=0;
 for(const row of manifest.files){
  for(const q of getArticle(row.id).quizzes){
   assert(q.question&&q.explanation,row.id);
   assert.equal(q.answers.length,3,row.id);
   assert(q.answers.every(a=>a.text),row.id);
   assert.equal(q.answers.filter(a=>a.correct).length,1,row.id);
   total++;
  }
 }
 assert.equal(total,991);
 assert.equal(manifest.files.reduce((n,r)=>n+r.sourceFourOptionQuestions,0),181);
});

test('каталог не разбирает подробные статьи до их открытия',()=>{
 const result=execFileSync(process.execPath,['-e',`
  const r=require('./reader');
  const loaded=()=>Object.keys(require.cache).filter(x=>x.includes('/data/articles/')).length;
  if(loaded()!==0)throw Error('Eagerly loaded content');
  r.hasFullArticle('SOF-001');
  if(loaded()!==0)throw Error('Metadata loaded content');
  r.getArticle('SOF-001');
  if(loaded()!==1)throw Error('Expected one article');
  process.stdout.write('OK');
 `],{cwd:root,encoding:'utf8'});
 assert.equal(result,'OK');
});
