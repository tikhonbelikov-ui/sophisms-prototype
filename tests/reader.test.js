const test=require('node:test');const assert=require('node:assert/strict');
const {getArticle,getRelated}=require('../reader');const {CARDS,PACKS}=require('../game');
test('каждая карточка каталога открывает статью',()=>{for(const c of CARDS){const a=getArticle(c.id);assert(a?.sections.length>0,c.id);assert(a.intro?.length>0,c.id)}});
test('основные четыре статьи структурированы и имеют реальные примеры',()=>{for(const id of ['SOF-001','SOF-002','SOF-003','SOF-004']){const a=getArticle(id);assert.equal(a.full,true);assert(a.sections.some(s=>/Реальные/.test(s.title)));assert(a.sections.some(s=>/не софизм/.test(s.title)))}});
test('все внутренние ссылки ведут на реально существующие статьи',()=>{for(const c of CARDS){for(const r of getRelated(c.id))assert(getArticle(r.id))}});
test('в игре всегда ровно 25 и 45 карт, независимо от каталога',()=>{assert.equal(PACKS[0].ids.length,25);assert.equal(PACKS[1].ids.length,45)});
