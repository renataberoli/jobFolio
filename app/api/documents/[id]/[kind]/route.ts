import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../../../chatgpt-auth";
import {getDb} from "../../../../../db";
import {applications} from "../../../../../db/schema";
import {and,eq} from "drizzle-orm";
export async function GET(request:Request,context:{params:Promise<{id:string;kind:string}>}) {
 const user=await getChatGPTUser();if(!user)return new Response("Please sign in",{status:401});
 const {id,kind}=await context.params;if(!["cv","letter"].includes(kind))return new Response("Not found",{status:404});
 const [item]=await getDb().select().from(applications).where(and(eq(applications.id,id),eq(applications.owner,user.userId)));if(!item)return new Response("Not found",{status:404});
 const key=kind==="cv"?item.cvKey:item.letterKey;if(!key)return new Response("File not found",{status:404});
 const file=await env.BUCKET?.get(key);if(!file)return new Response("File not found",{status:404});
 const name=kind==="cv"?item.cvName:item.letterName;
 return new Response(file.body,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(name),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
