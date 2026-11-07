import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Your next chapter/);
const anonymous=await fetch(base+'/api/applications');assert.equal(anonymous.status,401);
const signin=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=signin.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.ok(cookie,'local sign-in cookie');
const call=(path,options={})=>fetch(base+path,{...options,headers:{cookie,...options.headers}});
const initial=await call('/api/applications');assert.equal(initial.status,200);
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
 console.log('PASS: page, sign-in, persistence, optional salary, both file downloads, status update, validation, anonymous protection, and origin protection.');
}finally{
 const removed=await call('/api/applications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});assert.equal(removed.status,200);assert.equal((await call(`/api/documents/${id}/cv`)).status,404);console.log('PASS: record and document deletion; local test data cleaned up.');
}
