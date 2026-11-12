const { CARDS } = require('./game');
const index = require('./data/article_index.json');
const loaders = require('./data/article_loaders');
const getCard = id => CARDS.find(c => c.id === id);
const byName = name => CARDS.find(c => c.name === name || c.alternative_name === name);
const hasFullArticle = id => !!index[id];
function getArticle(id) {
  const c = getCard(id); if (!c) return null;
  if (loaders[id]) return { ...c, ...loaders[id](), full:true };
  return { ...c, full:false, intro:c.description, sections:[
    {title:'Концептуальный пример',paragraphs:[c.example]},
    {title:'Почему здесь ошибка',paragraphs:[c.explanation]},
    {title:'Граница применения',paragraphs:['Проверьте, действительно ли довод подменяет доказательство. Похожая формулировка сама по себе не всегда означает ошибку: многое зависит от контекста и подтверждений.']},
  ]};
}
// Editorial links; no automatic "same difficulty" recommendations.
const related = {
  'SOF-001':['SOF-003','SOF-017'], 'SOF-002':['SOF-003','SOF-004'],
  'SOF-003':['SOF-001','SOF-002'], 'SOF-004':['SOF-005','SOF-002'],
};
function getRelated(id){
  const article=getArticle(id);if(!article)return [];
  const text=(article.sections||[]).flatMap(s=>s.paragraphs).join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е');
  const mentions=CARDS.filter(c=>c.id!==id && text.includes(c.name.toLocaleLowerCase('ru').replace(/ё/g,'е'))).map(c=>c.id);
  return [...new Set([...(related[id]||[]),...mentions])].slice(0,6).map(getCard).filter(Boolean);
}
module.exports={getArticle,getRelated,byName,hasFullArticle};
