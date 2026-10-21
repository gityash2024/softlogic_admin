// One-time source transformation: give AI controls visible labels, retaining their bindings.
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=path.resolve(__dirname,'../src');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]);}
for(const file of [...walk(path.join(root,'features/ai')),...walk(path.join(root,'features/settings/softlogic-ai'))].filter(p=>p.endsWith('.tsx')&&!p.endsWith('ai-ui.tsx'))){
 let s=fs.readFileSync(file,'utf8'); const ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),patches=[];let wrapped=false;
 function visit(node){
  if(ts.isJsxSelfClosingElement(node)&&['Input','Textarea'].includes(node.tagName.getText())){
   const attrs=node.attributes.properties; const attr=n=>attrs.find(x=>x.name?.getText()===n);
   let ancestor=node.parent,hasLabel=false;
   while(ancestor){if(ts.isJsxElement(ancestor)&&['label','AiField','AiFilters'].includes(ancestor.openingElement.tagName.getText())){hasLabel=true;break;}ancestor=ancestor.parent;}
   if(!hasLabel){
    const siblingLabel=ts.isJsxElement(node.parent)&&node.parent.children.find(c=>ts.isJsxElement(c)&&c.openingElement.tagName.getText()==='label');
    if(siblingLabel){
     if(!attr('aria-label')){
      const bits=siblingLabel.children.filter(c=>!ts.isJsxText(c)||c.text.trim());
      let label;
      if(bits.length===1&&ts.isJsxText(bits[0]))label=JSON.stringify(bits[0].text.trim());
      if(bits.length===1&&ts.isJsxExpression(bits[0])&&bits[0].expression)label='{'+bits[0].expression.getText()+'}';
      if(label)patches.push([node.getStart()+1+node.tagName.getText().length,node.getStart()+1+node.tagName.getText().length,' aria-label='+label]);
     }
    }else if(attr('placeholder')||attr('aria-label')){
     const a=attr('aria-label')??attr('placeholder'); let label=a.initializer?.getText();
     if(label){
      const cls=attr('className');const spans=cls&&ts.isStringLiteral(cls.initializer)?cls.initializer.text.split(' ').filter(c=>c.includes('col-span-')).join(' '):'';
      patches.push([node.getStart(),node.end,`<AiField label=${label}${spans?' className='+JSON.stringify(spans):''}>${node.getText()}</AiField>`]);wrapped=true;
     }
    }
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);if(!patches.length)continue;
 for(const[a,b,repl]of patches.sort((x,y)=>y[0]-x[0]))s=s.slice(0,a)+repl+s.slice(b);
 if(wrapped)s="import { AiField } from '@/features/ai/components/ai-ui';\n"+s;
 fs.writeFileSync(file,s);
}
