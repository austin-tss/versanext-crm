const {calc}=require('../calc.js');const a=require('assert');
let c=calc({deposit:2000,monthly:300});a.strictEqual(c.total,960);a.strictEqual(c.clawback,600);
c=calc({deposit:2000,monthly:300,mult:true});a.strictEqual(Math.round(c.total),1140);
c=calc({deposit:2000,monthly:300,fees:1000});a.strictEqual(c.total,1060);
console.log('commission tests passed: $960, $1,140 with multiplier, $600 clawback');
