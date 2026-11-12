// Необязательный статический JSX-контроль: использует TypeScript, если установлен.
const ts=require('typescript');
const fs=require('fs');
for(const file of ['App.js','index.js','components.js','QuizSection.js','useQuizProgress.js']){
 const src=fs.readFileSync(require('path').join(__dirname,'..',file),'utf8');
 const res=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{allowJs:true,checkJs:false,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 const errors=(res.diagnostics||[]).filter(e=>e.category===ts.DiagnosticCategory.Error);
 if(errors.length){console.error(file,errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('\n'));process.exitCode=1;}
 else console.log('JSX syntax OK:',file);
}
