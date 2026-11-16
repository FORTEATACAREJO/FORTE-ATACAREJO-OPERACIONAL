/**
 * Nanapay migration bridge: this domain is retired as an application.
 * The old hostname only forwards browsers to the current Nanapay site.
 * No accounts, POS actions, or payments are accepted here.
 */
import http from 'node:http';
const PORT=Number(process.env.PORT||10000);
const NANAPAY='https://nanapay-forte.onrender.com';
http.createServer((req,res)=>{
 try{
  const request=new URL(req.url||'/','http://localhost');
  if(request.pathname==='/health'){
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
   return res.end(JSON.stringify({ok:true,status:'redirect-only',product:'Nanapay'}));
  }
  if(req.method==='GET'||req.method==='HEAD'){
   const location=NANAPAY+request.pathname+request.search;
   res.writeHead(302,{'Location':location,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   return res.end();
  }
  res.writeHead(410,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'Este endereço foi substituído pelo Nanapay.',url:NANAPAY}));
 }catch{res.writeHead(400);res.end();}
}).listen(PORT,'0.0.0.0',()=>console.log('Nanapay redirect-only bridge live on port',PORT));
