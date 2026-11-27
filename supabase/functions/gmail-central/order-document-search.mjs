// Search only the registered supplier and the lifetime of the selected OS.
export function orderDocumentQueries({references,senders,domains,createdAt}){
 const safeRefs=[...new Set((references||[]).map(v=>String(v||'').trim()).filter(v=>/^[A-Za-z0-9][A-Za-z0-9 /.-]{1,39}$/.test(v)))];
 const sources=[...new Set([...(senders||[]),...(domains||[])].map(v=>String(v).toLowerCase().trim()).filter(v=>/^[a-z0-9._+%-]+(?:@[a-z0-9.-]+)?\.[a-z]{2,}$/.test(v)))];
 const created=Date.parse(createdAt);
 if(!safeRefs.length||!sources.length||!Number.isFinite(created))throw Error('OS sem referência, data ou remetente de fornecedor homologado.');
 const scope='{'+sources.map(v=>'from:'+v).join(' ')+'} after:'+Math.floor(created/1000)+' has:attachment -in:spam -in:trash -in:sent';
 // Gmail does not always index XML or PDF contents, so search attachments
 // from the same allowed supplier as a fallback; actual linking validates XML.
 return [scope+' {'+safeRefs.map(v=>'"'+v+'"').join(' ')+'}',scope];
}
export function selectSearchMessages(pages,max=20){
 const ids=[...new Set(pages.flatMap(p=>(p.messages||[]).map(m=>m.id)).filter(id=>/^[a-f0-9]{10,40}$/i.test(id)))];
 return {ids:ids.slice(0,max),limited:ids.length>max||pages.some(p=>Boolean(p.nextPageToken))};
}
