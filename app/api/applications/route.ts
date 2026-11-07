import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { applications } from "../../../db/schema";
import { and, eq, desc } from "drizzle-orm";
const statuses = ["Saved", "Applied", "Interview", "Offer", "Closed"];
const error = (message: string, status = 400) => Response.json({error:message}, {status});
function sameOrigin(request: Request) { const origin = request.headers.get("origin"); return !origin || origin === new URL(request.url).origin; }
export async function GET() {
 const user = await getChatGPTUser(); if (!user) return error("Please sign in to see your applications.",401);
 try { const items = await getDb().select().from(applications).where(eq(applications.owner,user.userId)).orderBy(desc(applications.createdAt)); return Response.json({applications:items.map(({owner,cvKey,letterKey,...item})=>item)}, {headers:{"Cache-Control":"no-store"}}); } catch { return error("Your applications could not be loaded. Please try again.",500); }
}
export async function POST(request: Request) {
 if (!sameOrigin(request)) return error("Invalid origin",403);
 const user=await getChatGPTUser(); if(!user) return error("Please sign in before saving.",401);
 if(Number(request.headers.get("content-length"))>22*1024*1024) return error("Each document must be 10 MB or smaller.",413);
 const keys:string[]=[];
 try {
 const form=await request.formData(); const field=(key:string)=>String(form.get(key)||"").trim();
 const role=field("role"), company=field("company"), url=field("url"), salary=field("salary"), notes=field("notes");
 if(!role||!company||!url) return error("Add the job title, company, and job link.");
 if(role.length>200||company.length>200||url.length>4000||salary.length>200||notes.length>5000) return error("One of the fields is too long.");
 try { if(!["https:","http:"].includes(new URL(url).protocol)) throw Error(); } catch { return error("Enter a valid http or https job link."); }
 const cv=form.get("cv"), letter=form.get("letter");
 for(const f of [cv,letter]) { if(!(f instanceof File)||!f.size) return error("Attach both a CV and cover letter."); if(f.size>10*1024*1024) return error("Each document must be 10 MB or smaller."); if(!/\.(pdf|doc|docx|txt)$/i.test(f.name)) return error("Use PDF, DOC, DOCX, or TXT documents."); }
 if(!env.BUCKET) throw Error("Storage unavailable");
 const id=crypto.randomUUID(); const cvFile=cv as File, letterFile=letter as File;
 const cvKey=user.userId+"/"+id+"/cv",letterKey=user.userId+"/"+id+"/letter";
 for(const [key,file] of [[cvKey,cvFile],[letterKey,letterFile]] as const) { keys.push(key); await env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:"application/octet-stream"}}); }
 await getDb().insert(applications).values({id,owner:user.userId,role,company,url,salary:salary||null,notes:notes||null,cvKey,cvName:cvFile.name,letterKey,letterName:letterFile.name,createdAt:new Date().toISOString()});
 return Response.json({id},{status:201});
 } catch { if(env.BUCKET && keys.length) await Promise.allSettled(keys.map(k=>env.BUCKET!.delete(k))); return error("Could not save this application. Please try again.",500); }
}
export async function PATCH(request: Request) {
 if(!sameOrigin(request)) return error("Invalid origin",403);
 const user=await getChatGPTUser(); if(!user) return error("Sign in first.",401);
 try { const {id,status}=await request.json() as {id?:unknown;status?:unknown}; if(typeof id!=="string"||typeof status!=="string"||!statuses.includes(status))return error("Invalid status.");
 const result=await getDb().update(applications).set({status}).where(and(eq(applications.id,id),eq(applications.owner,user.userId))).returning({id:applications.id});
 return result.length?Response.json({ok:true}):error("Application not found.",404);
 }catch{return error("Could not update the status.",500);}
}
export async function DELETE(request: Request) {
 if(!sameOrigin(request))return error("Invalid origin",403);
 const user=await getChatGPTUser();if(!user)return error("Sign in first.",401);
 try { const {id}=await request.json() as {id?:unknown}; if(typeof id!=="string")return error("Invalid application."); const [item]=await getDb().select().from(applications).where(and(eq(applications.id,id),eq(applications.owner,user.userId)));if(!item)return error("Application not found.",404);
 if(!env.BUCKET)throw Error();await env.BUCKET.delete([item.cvKey,item.letterKey]);await getDb().delete(applications).where(and(eq(applications.id,id),eq(applications.owner,user.userId)));return Response.json({ok:true});
 }catch{return error("Could not delete this application. Please retry.",500);}
}
