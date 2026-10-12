// Облако (Supabase): вход через GitHub и запросы к базе. Без библиотек, только fetch.
// Файл общий для моих приложений: на одном домене github.io вход тоже общий (сессия в localStorage).
// Supabase → Project Settings → API: Project URL и anon (publishable) key. Ключ открытый, данные защищает RLS.
// Ключ service_role сюда не вставлять никогда: он обходит RLS.
const CLOUD={url:'https://ixvqhsahavrfsbrljkcy.supabase.co',key:'sb_publishable_XzQ-YfaOkrAnltLW6u34eQ_hycHsMt9'};

const Cloud=(()=>{
const AK='cloud_auth',VK='cloud_pkce';
class Err extends Error{constructor(m,status,net){super(m);this.status=status||0;this.net=!!net}}
const read=()=>{try{return JSON.parse(localStorage.getItem(AK))}catch(e){return null}};
const keep=s=>{try{s?localStorage.setItem(AK,JSON.stringify(s)):localStorage.removeItem(AK)}catch(e){}};
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const base=()=>CLOUD.url.replace(/\/+$/,'');

async function req(path,opt){
let r;try{r=await fetch(base()+path,opt)}catch(e){throw new Err('Нет связи с сервером',0,true)}
const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
if(r.ok)return j;
const m=j&&(j.message||j.msg||j.error_description||j.error);
throw new Err(m||'Ошибка сервера '+r.status,r.status)}

// ответ /auth/v1/token → сессия
async function token(grant,body){
const o=await req('/auth/v1/token?grant_type='+grant,{method:'POST',headers:{apikey:CLOUD.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
const md=(o.user&&o.user.user_metadata)||{};
const s={at:o.access_token,rt:o.refresh_token,exp:o.expires_at||Math.floor(Date.now()/1000)+(o.expires_in||3600),
user:{id:o.user.id,name:md.user_name||md.preferred_username||o.user.email||''}};
keep(s);return s}

// вход: PKCE, токены не появляются в адресной строке
async function signIn(){
const v=b64u(crypto.getRandomValues(new Uint8Array(32)));
localStorage.setItem(VK,v);
const ch=b64u(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
location.href=base()+'/auth/v1/authorize?'+new URLSearchParams({provider:'github',redirect_to:location.origin+location.pathname,code_challenge:ch,code_challenge_method:'s256'})}

// возврат с GitHub: ?code=… меняем на сессию (true — вход только что состоялся)
const ready=(async()=>{
const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1));
const code=q.get('code'),err=q.get('error_description')||h.get('error_description');
if(!code&&!err)return;
history.replaceState(null,'',location.pathname);
if(err)throw new Err(err);
const v=localStorage.getItem(VK);localStorage.removeItem(VK);
if(!v)throw new Err('вход начинали в другом окне, попробуй ещё раз');
await token('pkce',{auth_code:code,code_verifier:v});return true})();

// живой access token; обновляем заранее. Сессию каждый раз читаем заново:
// другое приложение на этом домене могло уже обновить токен
let refreshing=null;
async function access(force){
const s=read();if(!s)throw new Err('Нужно войти',401);
if(!force&&s.exp*1000-Date.now()>60e3)return s.at;
if(!refreshing)refreshing=token('refresh_token',{refresh_token:s.rt})
.catch(e=>{if(e.status>=400&&e.status<500&&e.status!=429)keep(null);throw e})
.finally(()=>{refreshing=null});
return (await refreshing).at}

// запрос к таблицам (PostgREST) от имени вошедшего пользователя
async function rest(method,path,body,prefer){
const go=async force=>{const h={apikey:CLOUD.key,Authorization:'Bearer '+await access(force)};
if(body!==undefined)h['Content-Type']='application/json';if(prefer)h.Prefer=prefer;
return req('/rest/v1/'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)})};
try{return await go(false)}catch(e){if(e.status!=401||!read())throw e;return go(true)}}

async function signOut(){const s=read();keep(null);
if(s)try{await fetch(base()+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:CLOUD.key,Authorization:'Bearer '+s.at}})}catch(e){}}

// общая лента events: сюда пишут все мои приложения
const event=(app,type,payload)=>rest('POST','events',{app,type,payload:payload||{}},'return=minimal');

return{ready,on:()=>!!(CLOUD.url&&CLOUD.key),user:()=>{const s=read();return s&&s.user},signIn,signOut,rest,event,Err}})();
