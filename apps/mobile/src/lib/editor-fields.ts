type Fields=Record<string,unknown>;
function keys(path:string){const parts=path.split('.');if(parts.some(k=>!k||['__proto__','constructor','prototype'].includes(k)))throw new Error('Invalid field path.');return parts;}
export function readField(value:Fields,path:string):unknown{return keys(path).reduce<unknown>((item,key)=>item&&typeof item==='object'?(item as Fields)[key]:undefined,value);}
/** Clone each parent so editing a nested field never mutates a saved record. */
export function writeField(value:Fields,path:string,next:unknown):Fields{
  const [head,...tail]=keys(path);
  const previous=value[head];
  return {...value,[head]:tail.length?writeField(previous&&typeof previous==='object'&&!Array.isArray(previous)?previous as Fields:{},tail.join('.'),next):next};
}
