// Record ownership: shared by the browser, the vnxt-crm-api Worker and tests.
var VO=(function(){
 var REC=['deals','customers','events','expenses'];
 function tag(D,u){REC.forEach(function(k){(D[k]||[]).forEach(function(r){if(r&&!r.owner)r.owner=u})});return D}
 function force(D,u){REC.forEach(function(k){D[k]=(D[k]||[]).filter(Boolean);D[k].forEach(function(r){r.owner=u})});return D}
 // What a user may see. blobs: {username: data}. Admin sees every rep's records; a rep only their own.
 function view(blobs,u,role){var own=JSON.parse(JSON.stringify(blobs[u]||{}));force(own,u);if(role!=='admin')return own;
  Object.keys(blobs).forEach(function(o){if(o===u)return;var b=blobs[o]||{};REC.forEach(function(k){own[k]=(own[k]||[]).concat((b[k]||[]).filter(Boolean).map(function(r){var c=JSON.parse(JSON.stringify(r));c.owner=o;return c}))})});return own}
 // Split a saved view back into per-owner record lists. Non-admins can only write their own.
 function split(D,u,role,known){var out={};out[u]={};Object.keys(D).forEach(function(k){if(REC.indexOf(k)<0)out[u][k]=D[k]});
  REC.forEach(function(k){(D[k]||[]).forEach(function(r){if(!r)return;var o=role==='admin'&&r.owner&&known.indexOf(r.owner)>=0?r.owner:u;r.owner=o;out[o]=out[o]||{};(out[o][k]=out[o][k]||[]).push(r)})});
  if(role==='admin')known.forEach(function(o){out[o]=out[o]||{};REC.forEach(function(k){out[o][k]=out[o][k]||[]})});
  REC.forEach(function(k){out[u][k]=out[u][k]||[]});return out}
 // Keep records a rep added after the admin loaded (not in base) so an admin save never wipes them.
 function keepNew(server,written,base){var b={};(base||[]).forEach(function(x){b[x]=1});REC.forEach(function(k){var ids={};(written[k]||[]).forEach(function(r){ids[r.id]=1});(server&&server[k]||[]).forEach(function(r){if(r&&!ids[r.id]&&!b[k+':'+r.id])written[k].push(r)})});return written}
 function filterOwner(list,u,role){return role==='admin'?list:list.filter(function(r){return r.owner===u})}
 return {REC:REC,tag:tag,force:force,view:view,split:split,keepNew:keepNew,filterOwner:filterOwner};
})();
if(typeof module!=='undefined')module.exports=VO;
