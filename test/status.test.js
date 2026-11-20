import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function statusHarness(){
 const htmlWrites=[];
 class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.text='';this.hidden=true;this.attributes={};}
  set innerHTML(value){htmlWrites.push(value);}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return this.text+this.children.map(c=>c.textContent).join('');}
  replaceChildren(...children){this.children=children;this.text='';}
  append(...children){this.children.push(...children);}
  setAttribute(name,value){this.attributes[name]=value;}
 }
 const status=new Element();
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function showStatus('),source.indexOf('function hideStatus('));
 const context={elements:{status},document:{createElement:tag=>new Element(tag)}};
 vm.runInNewContext(code+';globalThis.renderStatus=showStatus;',context);
 return{status,htmlWrites,show:context.renderStatus};
}
for(const type of ['loading','error'])test(`untrusted filename remains literal text in ${type} status`,()=>{
 const {status,htmlWrites,show}=statusHarness();
 const filename='<img src=x onerror="throw new Error(1)">.pdf';
 show(`Archivo ${filename}`,type);
 assert.deepEqual(htmlWrites,[], 'filename must never enter an HTML parser');
 assert.equal(status.textContent,`Archivo ${filename}`);
 assert.equal(status.hidden,false);
 assert.equal(status.children.some(c=>c.className==='spinner'),type==='loading');
});
