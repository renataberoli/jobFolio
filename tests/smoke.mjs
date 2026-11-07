import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Your next chapter/);
const anonymous=await fetch(base+'/api/applications');assert.equal(anonymous.status,401);
const signin=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=signin.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.ok(cookie,'local sign-in cookie');
const call=(path,options={})=>fetch(base+path,{...options,headers:{cookie,...options.headers}});
const initial=await call('/api/applications');assert.equal(initial.status,200);
for(const variant of ['blank','salary','cv-only','letter-only']){
 const data=new FormData();if(variant==='salary')data.set('salary','€50,000');if(variant==='cv-only')data.set('cv',new File(['optional cv'],'cv.txt'));if(variant==='letter-only')data.set('letter',new File(['optional letter'],'letter.txt'));
 const response=await call('/api/applications',{method:'POST',body:data});assert.equal(response.status,201,await response.clone().text());const {id}=await response.json();
 try{const list=await (await call('/api/applications')).json();const item=list.applications.find(a=>a.id===id);assert.ok(item);assert.equal(item.role,'');assert.equal(item.company,'');assert.equal(item.url,'');assert.equal(Boolean(item.cvName),variant==='cv-only');assert.equal(Boolean(item.letterName),variant==='letter-only');
 for(const kind of ['cv','letter']){const doc=await call(`/api/documents/${id}/${kind}`);assert.equal(doc.status,variant===kind+'-only'?200:404);}
 }finally{assert.equal((await call('/api/applications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})).status,200);}
}
console.log('PASS: empty entry, salary-only entry, CV-only entry, and cover-letter-only entry.');
const invalidUrl=new FormData();invalidUrl.set('url','javascript:alert(1)');assert.equal((await call('/api/applications',{method:'POST',body:invalidUrl})).status,400);
const body=new FormData();for(const [k,v] of Object.entries({role:'Smoke test role',company:'Test company',url:'https://example.com/job',salary:'€60,000 / year',notes:'Disposable local test'}))body.set(k,v);
body.set('cv',new File(['test cv document'],'cv.txt',{type:'text/plain'}));body.set('letter',new File(['test cover letter'],'letter.txt',{type:'text/plain'}));
const saved=await call('/api/applications',{method:'POST',body});assert.equal(saved.status,201,await saved.clone().text());const {id}=await saved.json();
try{
 const listed=await (await call('/api/applications')).json();const item=listed.applications.find(a=>a.id===id);assert.equal(item.salary,'€60,000 / year');assert.equal(item.cvName,'cv.txt');assert.equal(item.owner,undefined);
 const download=await call(`/api/documents/${id}/cv`);assert.equal(download.status,200);assert.equal(await download.text(),'test cv document');assert.match(download.headers.get('content-disposition'),/cv.txt/);
 const letter=await call(`/api/documents/${id}/letter`);assert.equal(await letter.text(),'test cover letter');
 assert.equal((await fetch(base+`/api/documents/${id}/cv`)).status,401);
 const updated=await call('/api/applications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:'Interview'})});assert.equal(updated.status,200);
 const updatedList=await (await call('/api/applications')).json();assert.equal(updatedList.applications.find(a=>a.id===id).status,'Interview');
 const invalid=await call('/api/applications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:'Invalid'})});assert.equal(invalid.status,400);
 const forged=await call('/api/applications',{method:'PATCH',headers:{'Content-Type':'application/json',origin:'https://other.example'},body:JSON.stringify({id,status:'Offer'})});assert.equal(forged.status,403);
 const edit=new FormData();edit.set('id',id);edit.set('role','Updated role');edit.set('company','Updated company');edit.set('url','https://example.com/updated');edit.set('salary','€75,000');edit.set('notes','Updated notes');
 const edited=await call('/api/applications',{method:'PUT',body:edit});assert.equal(edited.status,200,await edited.clone().text());
 let entry=(await (await call('/api/applications')).json()).applications.find(a=>a.id===id);assert.equal(entry.role,'Updated role');assert.equal(entry.company,'Updated company');assert.equal(entry.url,'https://example.com/updated');assert.equal(entry.salary,'€75,000');assert.equal(entry.notes,'Updated notes');assert.equal(entry.status,'Interview');assert.equal(entry.createdAt,item.createdAt);assert.equal(await (await call(`/api/documents/${id}/cv`)).text(),'test cv document');assert.equal(await (await call(`/api/documents/${id}/letter`)).text(),'test cover letter');
 assert.equal((await fetch(base+'/api/applications',{method:'PUT',body:edit})).status,401);
 assert.equal((await call('/api/applications',{method:'PUT',headers:{origin:'https://other.example'},body:edit})).status,403);
 const missing=new FormData();missing.set('id','nonexistent');assert.equal((await call('/api/applications',{method:'PUT',body:missing})).status,404);
 const badEdit=new FormData();badEdit.set('id',id);badEdit.set('url','javascript:alert(1)');assert.equal((await call('/api/applications',{method:'PUT',body:badEdit})).status,400);assert.equal((await (await call('/api/applications')).json()).applications.find(a=>a.id===id).role,'Updated role');
 const replace=new FormData();replace.set('id',id);replace.set('cv',new File(['replacement cv'],'new-cv.txt'));replace.set('removeLetter','true');replace.set('status','Offer');assert.equal((await call('/api/applications',{method:'PUT',body:replace})).status,200);
 entry=(await (await call('/api/applications')).json()).applications.find(a=>a.id===id);assert.equal(entry.cvName,'new-cv.txt');assert.equal(entry.letterName,'');assert.equal(entry.status,'Offer');assert.equal(await (await call(`/api/documents/${id}/cv`)).text(),'replacement cv');assert.equal((await call(`/api/documents/${id}/letter`)).status,404);
 const clear=new FormData();clear.set('id',id);clear.set('removeCv','true');assert.equal((await call('/api/applications',{method:'PUT',body:clear})).status,200);
 entry=(await (await call('/api/applications')).json()).applications.find(a=>a.id===id);assert.equal(entry.role,'');assert.equal(entry.company,'');assert.equal(entry.url,'');assert.equal(entry.salary,null);assert.equal(entry.notes,null);assert.equal(entry.cvName,'');assert.equal(entry.status,'Offer');assert.equal((await call(`/api/documents/${id}/cv`)).status,404);
 console.log('PASS: editing details, preserving documents and creation date, replacing/removing files, clearing optional fields, and edit validation/access protection.');
 console.log('PASS: page, sign-in, persistence, optional salary, both file downloads, status update, validation, anonymous protection, and origin protection.');
}finally{
 const removed=await call('/api/applications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});assert.equal(removed.status,200);assert.equal((await call(`/api/documents/${id}/cv`)).status,404);console.log('PASS: record and document deletion; local test data cleaned up.');
}
