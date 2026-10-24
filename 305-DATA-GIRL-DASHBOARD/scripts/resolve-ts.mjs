import {access,readFile} from 'node:fs/promises';
export async function resolve(specifier,context,nextResolve){
 try{return await nextResolve(specifier,context);}catch(error){
  if(!specifier.startsWith('.')||/\.[a-z]+$/i.test(specifier))throw error;
  for(const suffix of ['.ts','.tsx','.mjs']){const url=new URL(specifier+suffix,context.parentURL);try{await access(url);return {url:url.href,shortCircuit:true};}catch{}}
  throw error;
 }
}
export async function load(url,context,nextLoad){if(url.endsWith('.json'))return {format:'module',source:`export default ${await readFile(new URL(url),'utf8')};`,shortCircuit:true};return nextLoad(url,context);}
