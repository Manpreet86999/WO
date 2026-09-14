import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseSessionFromToken } from './cloud-sync.js';
const token=(project:string)=>`header.${Buffer.from(JSON.stringify({aud:project,iss:`https://securetoken.google.com/${project}`})).toString('base64url')}.signature`;
test('cloud login verifies Firebase identity instead of trusting decoded claims',async()=>{
  const original=globalThis.fetch;let called=0;
  globalThis.fetch=async()=>{called++;return new Response(JSON.stringify({users:[{localId:'verified-user'}]}));};
  try {
    const config={apiKey:'test',projectId:'body-os-test'};
    await assert.rejects(firebaseSessionFromToken(config,token('other-project')),/another Firebase project/);
    assert.equal(called,0);
    assert.equal((await firebaseSessionFromToken(config,token(config.projectId))).uid,'verified-user');
    assert.equal(called,1);
    globalThis.fetch=async()=>new Response('{}',{status:400});
    await assert.rejects(firebaseSessionFromToken(config,token(config.projectId)),/could not verify/);
  }finally{globalThis.fetch=original;}
});
