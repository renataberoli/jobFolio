import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin } from "../../profile-auth";
import { getDb } from "../../../db";
import { applications } from "../../../db/schema";
import { and, eq, desc } from "drizzle-orm";
import { applicationMethodError, getApplicationMethods } from "../../../lib/application-methods";
import { applicationStatuses as statuses } from "../../../lib/application-statuses";
const error = (message: string, status = 400) => Response.json({error:message}, {status});
export async function GET() {
 const user = await getAppUser(); if (!user) return error("Choose a profile to see your applications.",401);
 try { const items = await getDb().select().from(applications).where(eq(applications.owner,user.userId)).orderBy(desc(applications.createdAt)); return Response.json({applications:items.map(({owner,cvKey,letterKey,...item})=>item)}, {headers:{"Cache-Control":"no-store"}}); } catch { return error("Your applications could not be loaded. Please try again.",500); }
}
export async function POST(request: Request) { return saveApplication(request, false); }
export async function PUT(request: Request) { return saveApplication(request, true); }
async function saveApplication(request: Request, editing: boolean) {
 if (!sameOrigin(request)) return error("Invalid origin",403);
 const user=await getAppUser(); if(!user) return error("Choose a profile before saving.",401);
 if(Number(request.headers.get("content-length"))>22*1024*1024) return error("Each document must be 10 MB or smaller.",413);
 const keys:string[]=[];
 try {
 const form=await request.formData(); const field=(key:string)=>String(form.get(key)||"").trim();
 const methods=getApplicationMethods(form);
 if(!methods.easyApply&&!methods.manuallyApplied)return error(applicationMethodError);
 const id=editing?field("id"):crypto.randomUUID();
 const [existing]=editing?await getDb().select().from(applications).where(and(eq(applications.id,id),eq(applications.owner,user.userId))):[];
 if(editing&&!existing)return error("Application not found.",404);
 const status=field("status")||existing?.status||"Saved";if(!statuses.includes(status))return error("Invalid status.");
 const role=field("role"), company=field("company"), url=field("url"), salary=field("salary"), notes=field("notes");
 if(role.length>200||company.length>200||url.length>4000||salary.length>200||notes.length>5000) return error("One of the fields is too long.");
 if(url) try { if(!["https:","http:"].includes(new URL(url).protocol)) throw Error(); } catch { return error("Enter a valid http or https job link."); }
 const cv=form.get("cv"), letter=form.get("letter");
 for(const f of [cv,letter]) { if(f===null) continue; if(!(f instanceof File)||!f.size) return error("Choose a non-empty document or leave the upload blank."); if(f.size>10*1024*1024) return error("Each document must be 10 MB or smaller."); if(!/\.(pdf|doc|docx|txt)$/i.test(f.name)) return error("Use PDF, DOC, DOCX, or TXT documents."); }
 if((cv||letter)&&!env.BUCKET) throw Error("Storage unavailable");
 const cvFile=cv as File|null, letterFile=letter as File|null;
 const cvKey=cvFile?user.userId+"/"+id+"/cv/"+crypto.randomUUID():(field("removeCv")==="true"?"":existing?.cvKey||"");
 const letterKey=letterFile?user.userId+"/"+id+"/letter/"+crypto.randomUUID():(field("removeLetter")==="true"?"":existing?.letterKey||"");
 for(const [key,file] of [[cvKey,cvFile],[letterKey,letterFile]] as const) { if(!file)continue; keys.push(key); await env.BUCKET!.put(key,file.stream(),{httpMetadata:{contentType:"application/octet-stream"}}); }
 const values={...methods,role,company,url,salary:salary||null,notes:notes||null,status,cvKey,cvName:cvFile?.name||(cvKey?existing?.cvName||"":""),letterKey,letterName:letterFile?.name||(letterKey?existing?.letterName||"":"")};
 if(editing){
 const result=await getDb().update(applications).set(values).where(and(eq(applications.id,id),eq(applications.owner,user.userId))).returning({id:applications.id});
 if(!result.length){if(env.BUCKET)await Promise.allSettled(keys.map(key=>env.BUCKET!.delete(key)));return error("Application not found.",404);}
 }else await getDb().insert(applications).values({id,owner:user.userId,...values,createdAt:new Date().toISOString()});
 if(existing&&env.BUCKET){const obsolete=[existing.cvKey!==cvKey?existing.cvKey:"",existing.letterKey!==letterKey?existing.letterKey:""].filter(Boolean);await Promise.allSettled(obsolete.map(key=>env.BUCKET!.delete(key)));}

 return Response.json({id},{status:editing?200:201});
 } catch { if(env.BUCKET && keys.length) await Promise.allSettled(keys.map(k=>env.BUCKET!.delete(k))); return error("Could not save this application. Please try again.",500); }
}
export async function PATCH(request: Request) {
 if(!sameOrigin(request)) return error("Invalid origin",403);
 const user=await getAppUser(); if(!user) return error("Choose a profile first.",401);
 try { const {id,status}=await request.json() as {id?:unknown;status?:unknown}; if(typeof id!=="string"||typeof status!=="string"||!statuses.includes(status))return error("Invalid status.");
 const result=await getDb().update(applications).set({status}).where(and(eq(applications.id,id),eq(applications.owner,user.userId))).returning({id:applications.id});
 return result.length?Response.json({ok:true}):error("Application not found.",404);
 }catch{return error("Could not update the status.",500);}
}
export async function DELETE(request: Request) {
 if(!sameOrigin(request))return error("Invalid origin",403);
 const user=await getAppUser();if(!user)return error("Choose a profile first.",401);
 try { const {id}=await request.json() as {id?:unknown}; if(typeof id!=="string")return error("Invalid application."); const [item]=await getDb().select().from(applications).where(and(eq(applications.id,id),eq(applications.owner,user.userId)));if(!item)return error("Application not found.",404);
 const fileKeys=[item.cvKey,item.letterKey].filter(Boolean);if(fileKeys.length){if(!env.BUCKET)throw Error();await env.BUCKET.delete(fileKeys);}await getDb().delete(applications).where(and(eq(applications.id,id),eq(applications.owner,user.userId)));return Response.json({ok:true});
 }catch{return error("Could not delete this application. Please retry.",500);}
}
