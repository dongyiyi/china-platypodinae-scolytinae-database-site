import {buildTaxonSearchIndex,searchTaxonIndex} from './taxon-search.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let index=[];
const out=document.querySelector('#results');
const status=document.querySelector('#index-status');
const sources={
 Scolytinae:{base:'https://dongyiyi.github.io/china-scolytinae-database-site/',id:'vsn'},
 Platypodinae:{base:'https://dongyiyi.github.io/china-platypodinae-database-site/',id:'plt'}
};
async function init(){
 const config=await (await fetch('data/sites.json')).json();
 const data=await Promise.allSettled(Object.entries(config.subfamilies).map(async ([subfamily,c])=>{
   const base=c.base_url;
   if(subfamily==='Scolytinae'){
     const [a,b]=await Promise.all([fetch(base+c.index_path),fetch(base+c.ranks_path)]);
     if(!a.ok||!b.ok)throw Error('Scolytinae index unavailable');
     const [taxa,ranks]=await Promise.all([a.json(),b.json()]);
     if(new Set(taxa.map(t=>t.vsn)).size!==taxa.length)throw Error('Scolytinae duplicate IDs');
     document.querySelector('#scol-count').textContent=taxa.length;
     return buildTaxonSearchIndex(taxa,ranks).map(e=>({...e,subfamily}));
   }
   const a=await fetch('data/platypodinae-taxa.json');
   if(!a.ok)throw Error('Local Platypodinae index unavailable');
   const taxa=await a.json();
   if(new Set(taxa.map(t=>t.plt)).size!==taxa.length)throw Error('Platypodinae duplicate IDs');
   document.querySelector('#plat-count').textContent=taxa.length;
   return taxa.map(t=>({...t,vsn:t.plt,subfamily:'Platypodinae'})).flatMap(t=>buildTaxonSearchIndex([t],{genera:{},tribes:{}}).map(e=>({...e,subfamily:'Platypodinae'})));
 }));
 index=data.filter(x=>x.status==='fulfilled').flatMap(x=>x.value);
 const failures=data.filter(x=>x.status==='rejected');
 if(failures.length){status.textContent='One subfamily index could not be loaded; search may be incomplete.';failures.forEach(x=>console.error(x.reason))}
 else status.textContent='';
 search();
}
function search(){
 const q=document.querySelector('#q').value.trim();
 if(!q){out.innerHTML='';return}
 if(!index.length){out.innerHTML='<p class="notice">Search indexes are unavailable.</p>';return}
 const hits=searchTaxonIndex(index,q).slice(0,100);
 out.innerHTML=hits.length?hits.map(hit=>{
   const t=hit.taxon,sub=t.subfamily,id=sub==='Platypodinae'?t.plt:t.vsn,href=sources[sub].base+'taxa/'+encodeURIComponent(id)+'/';
   return '<a class="result" href="'+href+'"><strong><span class="scientific">'+esc(t.scientific_name)+'</span> '+esc(t.authorship)+'</strong><br><small>'+esc(sub)+' · '+esc(t.recommended_chinese_name||t.chinese_name||'—')+' · '+esc(id)+' · '+esc(t.tribe)+'</small>'+(hit.matchedKind.startsWith('chinese_')||hit.matchedKind==='former_chinese'?'<br><small>Matched '+esc(hit.matchedKind.replaceAll('_',' '))+': '+esc(hit.matchedValue)+'</small>':'')+'</a>';
 }).join(''):'<p class="notice">No matching published species profile.</p>';
}
document.querySelector('#search').addEventListener('submit',e=>{e.preventDefault();search()});
document.querySelector('#q').addEventListener('input',search);
init().catch(e=>{console.error(e);status.textContent='Search indexes could not be loaded.'});
