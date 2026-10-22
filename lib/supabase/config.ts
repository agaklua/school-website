const jwtRole=(key:string):string|null=>{
  try{const part=key.split(".")[1];if(!part)return null;const normalized=part.replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,"="))).role||null;}catch{return null;}
};
export function validSupabaseUrl(value:string|undefined):value is string{
  if(!value)return false;
  try{const url=new URL(value);return url.protocol==="https:"||(process.env.NODE_ENV!=="production"&&["localhost","127.0.0.1"].includes(url.hostname)&&url.protocol==="http:");}catch{return false;}
}
export function getPublicSupabaseConfig(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!validSupabaseUrl(url)||!key||key.startsWith("sb_secret_")||jwtRole(key)==="service_role")return null;
  return{url,key};
}
export function isSupabaseServiceKey(key:string|undefined):key is string{return !!key&&(key.startsWith("sb_secret_")||jwtRole(key)==="service_role");}
