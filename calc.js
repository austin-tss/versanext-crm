// VNXT commission calc (matches VersaNext employee portal rules). Shared by deal cards, deal page, new-deal form and Calculator tab.
(function(g){function calc(o){o=o||{};const dep=+o.deposit||0,mo=+o.monthly||0,fee=+o.fees||0,m=!!o.mult;
const bonus=mo,depC=dep*.15,rate=m?.15:.10,res=rate*mo*12,build=fee*.10;
return{bonus,dep:depC,res,rate,build,total:bonus+depC+res+build,clawback:bonus+depC}}
g.calc=calc;if(typeof module!='undefined')module.exports={calc}})(typeof window!='undefined'?window:globalThis);
