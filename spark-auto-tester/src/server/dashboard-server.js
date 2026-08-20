import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';

const TYPES={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8'};
function safeJoin(root,urlPath){const clean=decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/,''),target=path.resolve(root,clean||'index.html');if(!target.startsWith(path.resolve(root)))return null;return target;}
export function startDashboardServer(root,{port=3000,openBrowser=true}={}){
  const server=http.createServer(async(req,res)=>{
    let pathname=req.url||'/';
    if(pathname==='/')pathname='/latest/index.html';
    if(pathname==='/results.json')pathname='/latest/results.json';
    if(pathname==='/CHATBOT_IMPROVEMENTS.md')pathname='/latest/CHATBOT_IMPROVEMENTS.md';
    if(pathname==='/generated-questions.json')pathname='/latest/generated-questions.json';
    const file=safeJoin(root,pathname);
    if(!file){res.writeHead(403);res.end('Forbidden');return;}
    try{const stat=await fs.stat(file);const actual=stat.isDirectory()?path.join(file,'index.html'):file;const body=await fs.readFile(actual);res.writeHead(200,{'content-type':TYPES[path.extname(actual).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');}
  });
  server.listen(port,'127.0.0.1',()=>{const url=`http://127.0.0.1:${port}`;console.log(`\nDashboard: ${url}`);console.log('Press Ctrl+C to stop the local dashboard server.');if(openBrowser)openUrl(url);});
  return server;
}
function openUrl(url){try{if(process.platform==='win32')spawn('cmd',['/c','start','',url],{detached:true,stdio:'ignore'}).unref();else if(process.platform==='darwin')spawn('open',[url],{detached:true,stdio:'ignore'}).unref();else spawn('xdg-open',[url],{detached:true,stdio:'ignore'}).unref();}catch{}}
