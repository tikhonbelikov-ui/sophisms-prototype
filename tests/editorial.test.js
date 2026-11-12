const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {preview,displaySectionParagraphs} = require('../preview');
const {CARDS,isCorrectGuess} = require('../game');
const {getArticle} = require('../reader');
const curated = require('../tools/short_definitions.json');
const original33 = Object.keys(curated);

test('все 33 проблемных определения заменены на законченные и не обрезаются до 280 символов',()=>{
  assert.equal(original33.length,33);
  for (const id of original33){
    const c=CARDS.find(x=>x.id===id);
    assert(c,id);
    assert.equal(c.description,curated[id],id);
    assert(c.description.length<280,id);
    assert(/[.!?]$/.test(c.description),id);
  }
  assert(CARDS.every(c=>c.description.length!==280));
  assert(!CARDS.find(c=>c.id==='SOF-060').description.includes('интерпретируе'));
});

test('превью сокращает на границе слова, полный текст остаётся неизменённым',()=>{
  const raw='Первое законченное предложение с длинным словом невероятнаяцепочка. Второе предложение.';
  const clipped=preview(raw,32);
  assert.equal(clipped,'Первое законченное предложение…');
  assert.equal(raw,'Первое законченное предложение с длинным словом невероятнаяцепочка. Второе предложение.');
  assert.equal(preview('сверхдлинноесловобезпробелов',4),'сверхдлинноесловобезпробелов');
  assert.equal(preview('сверхдлинноесловобезпробелов следующее',4),'сверхдлинноесловобезпробелов…');
});

test('примеры имеют обычную нумерацию, без редакционных дублей и оценок достоверности',()=>{
  for(const c of CARDS){
    const article=getArticle(c.id);
    for(const section of article.sections.filter(s=>/^(Концептуальные|Реальные) примеры$/.test(s.title))){
      const displayed=displaySectionParagraphs(section);
      assert.equal(displayed.length,section.paragraphs.length,c.id);
      for(let i=0;i<displayed.length;i++){
        assert(new RegExp(`^${i+1}\\. `).test(displayed[i]),`${c.id}: ${displayed[i].slice(0,80)}`);
        assert(!/^(?:\d+\. )?(?:первый|второй) (?:реальный|концептуальный) пример\b/i.test(displayed[i]),c.id);
        assert(!/^(?:\d+\. )?реальным? примером? с высокой/i.test(displayed[i]),c.id);
      }
    }
  }
});

test('post hoc и cum hoc различаются и не дают ложного синонима в каталоге',()=>{
  const post=CARDS.find(x=>x.id==='SOF-012');
  const cum=CARDS.find(x=>x.id==='SOF-053');
  assert.match(post.alternative_name,/post hoc/);
  assert.doesNotMatch(post.alternative_name,/корреляция не равна причинности/i);
  assert.match(cum.alternative_name,/cum hoc/);
  assert.notEqual(post.name,cum.name);
  assert.match(post.description,/после/);
  assert.match(cum.description,/одновременно/);
  assert.match(getArticle(post.id).intro,/post hoc/);
  assert.match(getArticle(cum.id).intro,/cum hoc/);
  const spy={active:{s:['SOF-053']}};
  assert.equal(isCorrectGuess(spy,'SOF-012','s'),false);
  assert.equal(isCorrectGuess(spy,'SOF-053','s'),true);
});

test('исправлены R. J. Reynolds и все употребления ad Lazarum',()=>{
  const authority=getArticle('SOF-005');
  const real=authority.sections.find(s=>s.title==='Реальные примеры').paragraphs.join(' ');
  assert.match(real,/R\. J\. Reynolds/);
  assert.doesNotMatch(real,/Philip Morris/);
  assert.match(real,/Camels/);
  const poverty=getArticle('SOF-046');
  assert.match(poverty.intro,/ad Lazarum/);
  assert.match(poverty.quizzes[5].explanation,/ad Lazarum/);
  assert(!JSON.stringify(poverty).includes('at Lazarum'));
  assert(!fs.readFileSync(path.join(__dirname,'../source_lessons/Апелляция_к_бедности.txt'),'utf8').includes('at Lazarum'));
});
