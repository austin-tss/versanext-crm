const VO=require('../owner.js');const a=require('assert');
const blobs={austin:{nextNo:5,deals:[{id:1,company:'A'}],customers:[{id:10}]},stratton:{deals:[{id:2,company:'S',owner:'austin'}],customers:[{id:20}],events:[{id:30}]}};
let v=VO.view(blobs,'stratton','rep');a.deepStrictEqual(v.deals.map(d=>d.id),[2]);a.strictEqual(v.deals[0].owner,'stratton');a.strictEqual(v.customers.length,1);
v=VO.view(blobs,'austin','admin');a.deepStrictEqual(v.deals.map(d=>d.id+':'+d.owner).sort(),['1:austin','2:stratton']);a.strictEqual(v.customers.length,2);a.strictEqual(v.nextNo,5);
// admin saves: records go back to their owner; untouched rep lists kept, deletes respected
v.deals.push({id:3,company:'New'});v.events=[];let s=VO.split(v,'austin','admin',['austin','stratton']);
a.deepStrictEqual(s.austin.deals.map(d=>d.id).sort(),[1,3]);a.deepStrictEqual(s.stratton.deals.map(d=>d.id),[2]);a.deepStrictEqual(s.stratton.events,[]);a.strictEqual(s.austin.nextNo,5);
// rep cannot write into someone else's data by forging owner
s=VO.split({deals:[{id:9,owner:'austin'}]},'stratton','rep',['austin','stratton']);a.deepStrictEqual(Object.keys(s),['stratton']);a.strictEqual(s.stratton.deals[0].owner,'stratton');
// unknown owner falls back to the admin
s=VO.split({deals:[{id:9,owner:'ghost'}]},'austin','admin',['austin','stratton']);a.strictEqual(s.austin.deals[0].owner,'austin');
const L=[{owner:'austin'},{owner:'stratton'}];a.strictEqual(VO.filterOwner(L,'stratton','rep').length,1);a.strictEqual(VO.filterOwner(L,'austin','admin').length,2);
console.log('owner tests passed: rep sees only own, admin sees all, saves split by owner, forged owner blocked');
{const w={deals:[{id:2}]};VO.keepNew({deals:[{id:2},{id:7},{id:8}]},w,['deals:2','deals:8']);a.deepStrictEqual(w.deals.map(d=>d.id),[2,7]);
const s2=VO.split({deals:[]},'austin','admin',['austin','stratton']);a.deepStrictEqual(s2.stratton.deals,[]);console.log('owner tests passed: admin save keeps rep records added meanwhile, deletes applied');}
