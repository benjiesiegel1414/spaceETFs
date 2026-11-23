/* TopSpaceETFs shared script: live fund data, sticky predictive search, blog cover images */
(function(){
  var CSV='https://docs.google.com/spreadsheets/d/e/2PACX-1vSrmLZYgKhMuwExsTbxDBBrN0aTAj0KIlFH5kPeZblp_7FXO7AGfgwilgbt3qCKF9XIir_QTNeYRpqy/pub?gid=0&single=true&output=csv';
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function splitLine(line){var out=[],cur='',q=false;for(var i=0;i<line.length;i++){var c=line[i];if(c==='"'){q=!q;continue;}if(c===','&&!q){out.push(cur);cur='';continue;}cur+=c;}out.push(cur);return out;}
  function parseCSV(t){var L=t.trim().split(/\r?\n/),H=splitLine(L[0]).map(function(h){return h.trim();});return L.slice(1).map(function(l){var v=splitLine(l),o={};H.forEach(function(h,i){if(h)o[h]=(v[i]||'').trim();});return o;}).filter(function(r){return r.Symbol;});}
  function fmtAum(s){var m=/^\$?([\d.]+)\s*([BMK])/i.exec(s||'');if(!m)return s||'';var n=parseFloat(m[1]),u=m[2].toUpperCase();if(u==='B')return '$'+(n>=10?n.toFixed(1):n.toFixed(2))+'B';if(u==='M')return '$'+(n>=10?Math.round(n):n.toFixed(1))+'M';return '$'+Math.round(n)+'K';}
  function aumNum(s){var m=/([\d.]+)\s*([BMK])?/i.exec((s||'').replace(/[$,]/g,''));if(!m)return 0;var n=parseFloat(m[1]),u=(m[2]||'').toUpperCase();return n*(u==='B'?1e9:u==='M'?1e6:u==='K'?1e3:1);}
  function category(name){
    if(/\b2x\b|short|leverag|daily target|daily 2x/i.test(name))return 'Leveraged & Inverse';
    if(/income|enhanced/i.test(name))return 'Income';
    if(/aerospace|defense|drone|warfare/i.test(name)&&!/\bspace\b/i.test(name))return 'Aerospace & Defense';
    return 'Space';
  }
  function parseDate(s){if(!s)return null;var m=/^(\d{4})-(\d\d)-(\d\d)/.exec(s);if(m)return new Date(+m[1],+m[2]-1,+m[3]);var d=new Date(s);return isNaN(d)?null:d;}
  var cache=null;
  function load(){
    if(cache)return cache;
    cache=Promise.all([
      fetch(CSV).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}),
      fetch('/data/funds.json').then(function(r){return r.ok?r.json():{funds:{}};}).catch(function(){return {funds:{}};})
    ]).then(function(res){
      var rows=parseCSV(res[0]),J=res[1]||{},F=J.funds||{},now=new Date();
      rows.forEach(function(r){
        var sym=r.Symbol=r.Symbol.toUpperCase(),f=F[sym]||{};
        r.Name=(r.Name||sym).trim(); r['Fund Provider']=(r['Fund Provider']||'').trim();
        if(f.aum)r.AUM=fmtAum(f.aum); else r.AUM=fmtAum(r['AUM']||r['AUM ']||'');
        if(F[sym])r['Dividend Yield']=f.yield?parseFloat(f.yield).toFixed(1)+'%':'0.0%';
        if(f.expense)r['Expense Ratio']=f.expense;
        var d=parseDate(f.inception||r['Inception Date']);
        r._inc=d; if(d)r['Inception Date']=MON[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
        r._aum=aumNum(r.AUM); r._yield=parseFloat(r['Dividend Yield'])||0; r._exp=parseFloat(r['Expense Ratio'])||0;
        r._hold=f.holdings||null; r._freq=f.freq||null; r._cat=category(r.Name);
        var p=parseFloat(r.Price); if(!(p>0))p=f.price||null; r._price=p;
        var c=parseFloat(r['Day Change']); r._chg=isNaN(c)?null:c;
        var k=(p&&f.price)?p/f.price:1;
        r._ytd=(f.ytd!=null)?((1+f.ytd/100)*k-1)*100:null;
        r._y1=(f.y1!=null)?((1+f.y1/100)*k-1)*100:null;
        r._si=(p&&f.pMAX)?(p/f.pMAX-1)*100:null;
        r._new=!!(d&&d.getFullYear()===now.getFullYear());
        if(r._ytd==null&&r._new)r._ytd=r._si;   /* launched this year: YTD equals since inception */
      });
      return {rows:rows,updated:J.updated||null};
    });
    return cache;
  }
  function pct(n,d){if(n==null||isNaN(n))return '';return (n>=0?'+':'')+n.toFixed(d==null?1:d)+'%';}
  function cls(n){return n==null?'fl':n>0?'up':n<0?'dn':'fl';}
  window.TSE={load:load,pct:pct,cls:cls,fmtAum:fmtAum};

  /* ---------- sticky predictive search ---------- */
  var CSS='#tsx{position:sticky;top:0;z-index:60;background:rgba(10,8,20,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #2a2540;font-family:Inter,-apple-system,sans-serif}#tsx.pin{position:fixed;left:0;right:0;top:0}#tsx *{box-sizing:border-box}#tsx .in{max-width:1180px;margin:0 auto;padding:7px 24px;display:flex;align-items:center;gap:14px;position:relative}#tsx .box{flex:1;display:flex;align-items:center;gap:10px;background:#141126;border:1px solid #2a2540;border-radius:9px;padding:0 12px;height:34px;transition:border-color .15s,box-shadow .15s}#tsx .box:focus-within{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.18)}#tsx svg{flex-shrink:0;color:#a8a3bd}#tsx input{flex:1;background:none;border:0;outline:0;color:#f5f3ff;font:500 14px Inter,sans-serif;min-width:0}#tsx input::placeholder{color:#7d7896}#tsx kbd{font:600 11px "JetBrains Mono",monospace;color:#a8a3bd;border:1px solid #2a2540;border-radius:5px;padding:1px 6px}#tsx .links{display:flex;gap:16px;font-size:13px;font-weight:600;white-space:nowrap}#tsx .links a{color:#a8a3bd;text-decoration:none}#tsx .links a:hover{color:#fff}#tsxList{position:absolute;left:24px;right:24px;top:calc(100% + 4px);background:#110e20;border:1px solid #2a2540;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.6);max-height:min(70vh,520px);overflow:auto;display:none;padding:6px}#tsxList.open{display:block}#tsxList .grp{font:700 10px "JetBrains Mono",monospace;letter-spacing:1.6px;text-transform:uppercase;color:#7d7896;padding:10px 10px 4px}#tsxList a{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:8px;color:#f5f3ff;text-decoration:none}#tsxList a.on,#tsxList a:hover{background:rgba(139,92,246,.16)}#tsxList .tk{font:700 11.5px "JetBrains Mono",monospace;color:#b794f6;background:rgba(139,92,246,.14);border:1px solid rgba(139,92,246,.3);border-radius:6px;padding:3px 0;width:54px;text-align:center;flex-shrink:0}#tsxList .nm{flex:1;min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tsxList .nm small{display:block;color:#a8a3bd;font-weight:500;font-size:12px;overflow:hidden;text-overflow:ellipsis}#tsxList .rt{font:600 13px "JetBrains Mono",monospace;text-align:right;flex-shrink:0}#tsxList .rt small{display:block;font-size:11px}#tsxList mark{background:none;color:#b794f6}#tsxList .none{padding:18px 12px;color:#a8a3bd;font-size:14px}#tsx .up{color:#34d399}#tsx .dn{color:#f87171}#tsx .fl{color:#a8a3bd}@media(max-width:700px){#tsx .links,#tsx kbd{display:none}#tsx .in{padding:7px 14px}#tsxList{left:10px;right:10px}}';
  var PAGES=[['Space ETF rankings','/#rankings','Live table of every fund'],['Advertise','/advertise','Sponsor the whole site'],['Why space ETFs','/#why','The case for the sector'],['Blog','/blog','All articles'],['Space ETFs 101','/space-etfs-101','Beginner guide']];
  var CATS=[['Space','Pure space and space economy ETFs'],['Aerospace & Defense','Broad aerospace and defense ETFs'],['Leveraged & Inverse','2x long and short single-stock and basket ETFs'],['Income','Options income space ETFs']];
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function hl(s,q){var i=s.toLowerCase().indexOf(q);if(i<0||!q)return esc(s);return esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+q.length))+'</mark>'+esc(s.slice(i+q.length));}
  function initSearch(){
    if(document.getElementById('tsx'))return;
    var hdr=document.querySelector('header'); if(!hdr)return;
    var st=document.createElement('style'); st.textContent=CSS+'header{position:static !important}'; document.head.appendChild(st);
    var bar=document.createElement('div'); bar.id='tsx';
    bar.innerHTML='<div class="in"><div class="box"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="tsxQ" type="search" placeholder="Search space ETFs, tickers, issuers and articles" autocomplete="off" aria-label="Search TopSpaceETFs" role="combobox" aria-expanded="false" aria-controls="tsxList"><kbd>/</kbd></div><nav class="links"><a href="/#rankings">Rankings</a><a href="/blog">Blog</a></nav><div id="tsxList" role="listbox"></div></div>';
    hdr.parentNode.insertBefore(bar,hdr.nextSibling);
    var ph=document.createElement('div'); ph.style.display='none'; bar.parentNode.insertBefore(ph,bar);
    function pin(){var top=(ph.style.display==='none'?bar:ph).getBoundingClientRect().top;if(top<=0&&!bar.classList.contains('pin')){ph.style.height=bar.offsetHeight+'px';ph.style.display='block';bar.classList.add('pin');}else if(bar.classList.contains('pin')&&ph.getBoundingClientRect().top>0){bar.classList.remove('pin');ph.style.display='none';}}
    window.addEventListener('scroll',pin,{passive:true}); window.addEventListener('resize',pin); pin();
    var q=document.getElementById('tsxQ'),list=document.getElementById('tsxList'),funds=[],posts=[],act=-1,loaded=false;
    function ensure(){
      if(loaded)return; loaded=true;
      load().then(function(d){funds=d.rows;render();}).catch(function(){});
      fetch('/blog').then(function(r){return r.text();}).then(function(h){
        var doc=new DOMParser().parseFromString(h,'text/html');
        doc.querySelectorAll('article.blog-card').forEach(function(a){var l=a.closest('a'),t=a.querySelector('h3'),tag=a.querySelector('.blog-tag');if(l&&t)posts.push({t:t.textContent.trim(),u:new URL(l.getAttribute('href'),location.origin).pathname,g:tag?tag.textContent.trim():'Article'});});
        render();
      }).catch(function(){});
    }
    function render(){
      var v=q.value.trim().toLowerCase(),h='';
      if(!v){
        var top=funds.slice().sort(function(a,b){return b._aum-a._aum;}).slice(0,6);
        if(top.length){h+='<div class="grp">Largest space ETFs</div>';top.forEach(function(r){h+=fundRow(r,'');});}
        if(posts.length){h+='<div class="grp">Latest articles</div>';posts.slice(0,4).forEach(function(p){h+=postRow(p,'');});}
      }else{
        var fs=funds.map(function(r){var s=r.Symbol.toLowerCase(),sc=s===v?0:s.indexOf(v)===0?1:s.indexOf(v)>=0?2:r.Name.toLowerCase().indexOf(v)>=0?3:(r['Fund Provider']||'').toLowerCase().indexOf(v)>=0?4:99;return [sc,r];}).filter(function(x){return x[0]<99;}).sort(function(a,b){return a[0]-b[0]||b[1]._aum-a[1]._aum;}).slice(0,7);
        var cs=CATS.filter(function(c){return c[0].toLowerCase().indexOf(v)>=0;});
        var ps=posts.filter(function(p){return p.t.toLowerCase().indexOf(v)>=0;}).slice(0,6);
        var pg=PAGES.filter(function(p){return p[0].toLowerCase().indexOf(v)>=0;});
        if(fs.length){h+='<div class="grp">ETFs</div>';fs.forEach(function(x){h+=fundRow(x[1],v);});}
        if(cs.length){h+='<div class="grp">Categories</div>';cs.forEach(function(c){h+='<a role="option" href="/?cat='+encodeURIComponent(c[0])+'#rankings"><span class="tk">LIST</span><span class="nm">'+hl(c[0],v)+'<small>'+esc(c[1])+'</small></span></a>';});}
        if(ps.length){h+='<div class="grp">Articles</div>';ps.forEach(function(p){h+=postRow(p,v);});}
        if(pg.length){h+='<div class="grp">Pages</div>';pg.forEach(function(p){h+='<a role="option" href="'+p[1]+'"><span class="tk">PAGE</span><span class="nm">'+hl(p[0],v)+'<small>'+esc(p[2])+'</small></span></a>';});}
        if(!h)h='<div class="none">No matches for "'+esc(q.value.trim())+'". Try a ticker like UFO or a topic like SpaceX.</div>';
      }
      list.innerHTML=h; act=-1;
      var open=!!h&&document.activeElement===q; list.classList.toggle('open',open); q.setAttribute('aria-expanded',open?'true':'false');
    }
    function fundRow(r,v){
      var px=r._price?'$'+r._price.toFixed(2):'',ch=r._chg!=null?'<small class="'+cls(r._chg)+'">'+pct(r._chg,2)+'</small>':'';
      return '<a role="option" href="/'+encodeURIComponent(r.Symbol)+'"><span class="tk">'+hl(r.Symbol,v)+'</span><span class="nm">'+hl(r.Name,v)+'<small>'+hl(r['Fund Provider']||'',v)+' · '+esc(r._cat)+'</small></span><span class="rt">'+px+ch+'</span></a>';
    }
    function postRow(p,v){return '<a role="option" href="'+p.u+'"><span class="tk">READ</span><span class="nm">'+hl(p.t,v)+'<small>'+esc(p.g)+'</small></span></a>';}
    function move(d){var it=list.querySelectorAll('a');if(!it.length)return;if(act>=0&&it[act])it[act].classList.remove('on');act=(act+d+it.length)%it.length;it[act].classList.add('on');it[act].scrollIntoView({block:'nearest'});}
    q.addEventListener('focus',function(){ensure();render();});
    q.addEventListener('input',function(){ensure();render();});
    q.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'){e.preventDefault();move(1);}
      else if(e.key==='ArrowUp'){e.preventDefault();move(-1);}
      else if(e.key==='Enter'){var it=list.querySelectorAll('a');var t=it[act>=0?act:0];if(t){e.preventDefault();location.href=t.getAttribute('href');}}
      else if(e.key==='Escape'){q.blur();list.classList.remove('open');}
    });
    document.addEventListener('click',function(e){if(!bar.contains(e.target))list.classList.remove('open');});
    document.addEventListener('keydown',function(e){if(e.key==='/'&&!/input|textarea|select/i.test((e.target.tagName||''))){e.preventDefault();q.focus();}});
  }

  /* ---------- blog cover images ---------- */
  var GENERIC=8;
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
  function covers(root){
    (root||document).querySelectorAll('article.blog-card').forEach(function(a){
      var l=a.closest('a'),th=a.querySelector('.blog-thumb'); if(!l||!th||th.querySelector('img'))return;
      var slug=(l.getAttribute('href')||'').split('?')[0].replace(/\/$/,'').split('/').pop().replace(/\.html$/,''); if(!slug)return;
      var t=a.querySelector('h3'),img=new Image();
      img.alt=t?t.textContent.trim():''; img.decoding='async';
      img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';
      img.onerror=function(){img.onerror=null;img.src='/covers/generic-'+(hash(slug)%GENERIC+1)+'.jpg';};
      img.onload=function(){th.innerHTML='';th.style.cssText+=';padding:0;height:170px;background:#0a0814;overflow:hidden';th.classList.add('has-img');th.appendChild(img);};
      img.src='/covers/'+slug+'.jpg';
    });
  }
  window.TSE.covers=covers;
  function postCover(){
    var slug=location.pathname.replace(/\/$/,'').split('/').pop().replace(/\.html$/,'');
    if(!slug||/^(index|blog|etf|legal|privacy-policy|terms-of-use|advertise)$/.test(slug))return;
    var art=document.querySelector('.article-content'); if(!art||art.querySelector('img[src^="/covers/"]'))return;
    var h=document.querySelector('h1'),img=new Image();
    img.alt=h?h.textContent.trim():''; img.width=1200; img.height=630;
    img.style.cssText='width:100%;height:auto;border-radius:16px;border:1px solid #2a2540;display:block;margin:0 0 28px';
    img.onload=function(){art.insertBefore(img,art.firstChild);};
    img.src='/covers/'+slug+'.jpg';
  }
  /* ---------- site-wide footer ---------- */
  var FCSS='#tsf{border-top:1px solid #2a2540;background:#0a0814;font-family:Inter,-apple-system,sans-serif;color:#a8a3bd;margin-top:40px}#tsf *{box-sizing:border-box}#tsf a{color:#a8a3bd;text-decoration:none}#tsf a:hover{color:#fff}#tsf .in{max-width:1240px;margin:0 auto;padding:44px 24px 26px}#tsf .cta{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;border:1px solid #2a2540;border-radius:16px;padding:20px 24px;background:linear-gradient(120deg,rgba(139,92,246,.16),rgba(15,13,28,.9));margin-bottom:38px}#tsf .cta b{display:block;color:#f5f3ff;font-size:17px;font-weight:700}#tsf .cta span{font-size:14px}#tsf .cta a{background:#8b5cf6;color:#fff;font-weight:700;font-size:14px;border-radius:10px;padding:11px 18px;white-space:nowrap}#tsf .cols{display:grid;grid-template-columns:1.5fr repeat(5,1fr);gap:28px}#tsf h4{font:700 11px "JetBrains Mono",monospace;letter-spacing:1.6px;text-transform:uppercase;color:#f5f3ff;margin:0 0 14px}#tsf ul{list-style:none;margin:0;padding:0}#tsf li{margin:0 0 9px;font-size:13.5px;line-height:1.35}#tsf li a b{font:700 12px "JetBrains Mono",monospace;color:#b794f6;margin-right:6px}#tsf .brand{font-weight:800;font-size:19px;color:#f5f3ff;display:block;margin-bottom:10px}#tsf .brand i{font-style:normal;color:#b794f6}#tsf .about{font-size:13.5px;line-height:1.6;max-width:300px}#tsf .tick{display:flex;flex-wrap:wrap;gap:7px;margin:30px 0 0;padding-top:24px;border-top:1px solid #1d1930}#tsf .tick a{font:600 12px "JetBrains Mono",monospace;color:#b794f6;border:1px solid rgba(139,92,246,.3);border-radius:999px;padding:4px 10px}#tsf .tick a:hover{background:#8b5cf6;color:#fff}#tsf .bot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:26px;padding-top:20px;border-top:1px solid #1d1930;font-size:12.5px}#tsf .fine{font-size:12px;color:#7d7896;margin-top:14px;line-height:1.6}@media(max-width:1000px){#tsf .cols{grid-template-columns:1fr 1fr 1fr}#tsf .cols>div:first-child{grid-column:1/-1}}@media(max-width:560px){#tsf .cols{grid-template-columns:1fr 1fr}}';
  function li(h,t){return '<li><a href="'+h+'">'+t+'</a></li>';}
  function footer(){
    if(document.getElementById('tsf'))return;
    var old=document.querySelector('footer'); if(!old)return;
    var st=document.createElement('style'); st.textContent=FCSS; document.head.appendChild(st);
    var f=document.createElement('footer'); f.id='tsf';
    f.innerHTML='<div class="in"><div class="cta"><div><b>Put your fund in front of space ETF investors</b><span>One exclusive sponsor. Every page. From $995 for 3 months.</span></div><a href="/advertise">Advertise on TopSpaceETFs</a></div>'+
    '<div class="cols"><div><a class="brand" href="/">Top<i>Space</i>ETFs.com</a><p class="about">Independent data and research on space, satellite and aerospace ETFs. Live prices, returns, holdings and fees for every fund, refreshed automatically. Part of the Dividend Empire network.</p></div>'+
    '<div><h4>Rankings</h4><ul>'+li('/#rankings','All space ETFs')+li('/?cat=Space#rankings','Pure space ETFs')+li('/?cat=Aerospace%20%26%20Defense#rankings','Aerospace &amp; defense')+li('/?cat=Leveraged%20%26%20Inverse#rankings','Leveraged &amp; inverse')+li('/?cat=Income#rankings','Income ETFs')+li('/best-performing-space-etfs-2026','Best performing')+li('/space-etf-expense-ratios-compared','Lowest fees')+'</ul></div>'+
    '<div><h4>Top funds</h4><ul id="tsfTop">'+li('/UFO','<b>UFO</b>Procure Space')+li('/NASA','<b>NASA</b>Tema Space Innovators')+li('/ARKX','<b>ARKX</b>ARK Space &amp; Defense')+li('/ROKT','<b>ROKT</b>SPDR Final Frontiers')+li('/ITA','<b>ITA</b>iShares Aerospace')+'</ul></div>'+
    '<div><h4>Holdings</h4><ul>'+li('/etfs-that-hold-spacex','ETFs that hold SpaceX')+li('/etfs-that-hold-rocket-lab','ETFs that hold Rocket Lab')+li('/etfs-that-hold-ast-spacemobile','ETFs that hold AST SpaceMobile')+li('/etfs-that-hold-intuitive-machines','ETFs that hold Intuitive Machines')+li('/etfs-that-hold-planet-labs','ETFs that hold Planet Labs')+li('/etfs-that-hold-firefly-aerospace','ETFs that hold Firefly')+li('/etfs-that-hold-kratos','ETFs that hold Kratos')+'</ul></div>'+
    '<div><h4>Guides</h4><ul>'+li('/space-etfs-101','Space ETFs 101')+li('/ufo-vs-arkx-vs-rokt-2026','UFO vs ARKX vs ROKT')+li('/nasa-vs-mars-vs-orbx-vs-warp-2026','NASA vs MARS vs ORBX vs WARP')+li('/leveraged-spacex-etfs-spch-spax-spal-spcu','Leveraged SpaceX ETFs')+li('/do-space-etfs-pay-dividends','Space ETF dividends')+li('/spacex-ipo-public-spcx','SpaceX IPO')+li('/blog','All articles')+'</ul></div>'+
    '<div><h4>Company</h4><ul>'+li('/advertise','Advertise')+li('mailto:Business@TopDividendETFs.com','Contact')+li('/legal','Disclosure')+li('/privacy-policy','Privacy policy')+li('/terms-of-use','Terms of use')+'</ul><h4 style="margin-top:22px">Our network</h4><ul>'+li('https://topdividendetfs.com','TopDividendETFs.com')+li('https://monthlyetfs.com','MonthlyETFs.com')+li('https://weeklyetfs.com','WeeklyETFs.com')+li('https://growthetfs.com','GrowthETFs.com')+li('https://topdividendetfspro.com','TopDividendETFsPRO')+'</ul></div></div>'+
    '<div class="tick" id="tsfTick"></div>'+
    '<div class="bot"><span>© '+new Date().getFullYear()+' TopSpaceETFs.com. All rights reserved.</span><span>Not investment advice. Data updates automatically.</span></div>'+
    '<p class="fine">TopSpaceETFs.com is for informational and educational purposes only and does not provide investment, financial, tax or legal advice. Fund data comes from public sources and may be delayed or contain errors. Always read the prospectus on the fund issuer\'s website and consider speaking with a licensed financial advisor before investing.</p></div>';
    old.parentNode.replaceChild(f,old);
    load().then(function(d){
      var rows=d.rows.slice().sort(function(a,b){return b._aum-a._aum;});
      var sp=rows.filter(function(r){return r._cat==='Space';}).slice(0,7);
      if(sp.length>=5)document.getElementById('tsfTop').innerHTML=sp.map(function(r){return li('/'+r.Symbol,'<b>'+r.Symbol+'</b>'+esc(r.Name.replace(/ ETF$| Fund$/,'')));}).join('');
      document.getElementById('tsfTick').innerHTML=rows.map(function(r){return '<a href="/'+r.Symbol+'" title="'+esc(r.Name)+'">'+r.Symbol+'</a>';}).join('');
    }).catch(function(){});
  }
  try{if(/\.html$/.test(location.pathname))history.replaceState(null,'',location.pathname.replace(/index\.html$/,'').replace(/\.html$/,'')+location.search+location.hash);}catch(e){}
  /* ---------- article side rails ---------- */
  var QS=[['Which ETFs hold SpaceX?','/etfs-that-hold-spacex'],['What is the best performing space ETF?','/best-performing-space-etfs-2026'],['Which space ETF has the lowest fee?','/space-etf-expense-ratios-compared'],['Do space ETFs pay dividends?','/do-space-etfs-pay-dividends'],['Are 2x SpaceX ETFs safe to hold?','/leveraged-spacex-etfs-spch-spax-spal-spcu'],['UFO, ARKX or ROKT?','/ufo-vs-arkx-vs-rokt-2026'],['NASA, MARS, ORBX or WARP?','/nasa-vs-mars-vs-orbx-vs-warp-2026'],['New to space ETFs? Start here','/space-etfs-101']];
  var RCSS='.tsr{position:fixed;top:74px;width:250px;overflow:hidden;z-index:30;font-family:Inter,-apple-system,sans-serif;opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .25s,transform .25s}.tsr::-webkit-scrollbar{display:none}.tsr.show{opacity:1;pointer-events:auto;transform:none}.tsr *{box-sizing:border-box}.tsb{background:#0f0d1c;border:1px solid #2a2540;border-radius:14px;margin-bottom:14px;overflow:hidden}.tsb h5{font:700 10.5px "JetBrains Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;color:#f5f3ff;margin:0;padding:12px 14px;border-bottom:1px solid #2a2540;background:#0c0a18;display:flex;justify-content:space-between;align-items:center}.tsb h5 a{color:#b794f6;text-decoration:none;letter-spacing:.3px;text-transform:none;font:600 11.5px Inter,sans-serif}.tsb a.row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #1d1930;text-decoration:none;color:#f5f3ff;font-size:13px;line-height:1.35}.tsb a.row:last-child{border-bottom:0}.tsb a.row:hover{background:rgba(139,92,246,.12)}.tsb a.row b{font:700 11.5px "JetBrains Mono",monospace;color:#b794f6;min-width:44px}.tsb a.row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#a8a3bd;font-size:12px}.tsb a.row em{font:600 11.5px "JetBrains Mono",monospace;font-style:normal;text-align:right;white-space:nowrap}.tsb a.q{display:block;padding:10px 14px;border-bottom:1px solid #1d1930;text-decoration:none;color:#f5f3ff;font-size:13px;font-weight:500;line-height:1.4}.tsb a.q:last-child{border-bottom:0}.tsb a.q:hover{background:rgba(139,92,246,.12);color:#b794f6}.tsb a.q::after{content:" →";color:#b794f6}.tsb .tst a{display:block;padding:7px 14px 7px 12px;border-left:2px solid transparent;text-decoration:none;color:#a8a3bd;font-size:12.5px;line-height:1.4}.tsb .tst a:hover{color:#fff}.tsb .tst a.on{color:#fff;border-left-color:#8b5cf6;background:rgba(139,92,246,.1)}.tsb .tst{padding:8px 0}.tsp{height:3px;background:#1d1930}.tsp i{display:block;height:100%;width:0;background:linear-gradient(90deg,#8b5cf6,#b794f6)}.tsb .btn2{display:block;margin:12px 14px;text-align:center;background:#8b5cf6;color:#fff;font:700 12.5px Inter,sans-serif;border-radius:9px;padding:9px;text-decoration:none}.tsb .up{color:#34d399}.tsb .dn{color:#f87171}.tsb .fl{color:#a8a3bd}.tsin{margin:34px 0;font-family:Inter,-apple-system,sans-serif}.tsin .g{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:640px){.tsin .g{grid-template-columns:1fr}}@media(min-width:1400px){.tsin{display:none}}@media(max-width:1399px){.tsr{display:none}}';
  function fundRows(rows,n){return rows.slice(0,n).map(function(r){return '<a class="row" href="/'+r.Symbol+'" title="'+esc(r.Name)+'"><b>'+r.Symbol+'</b><span>'+esc(r.Name.replace(/ ETF$| Fund$/,''))+'</span><em>'+(r._price?'$'+r._price.toFixed(2):'')+(r._chg!=null?'<br><i style="font-style:normal" class="'+cls(r._chg)+'">'+pct(r._chg,2)+'</i>':'')+'</em></a>';}).join('');}
  function rails(){
    var art=document.querySelector('.article-content'); if(!art||document.querySelector('.tsr'))return;
    var st=document.createElement('style'); st.textContent=RCSS; document.head.appendChild(st);
    var hs=[].slice.call(art.querySelectorAll('h2')).filter(function(h){return !/related posts|sources/i.test(h.textContent);});
    hs.forEach(function(h,i){if(!h.id)h.id='sec-'+(i+1);});
    var qs=QS.filter(function(q){return location.pathname.indexOf(q[1])<0;});
    var qhtml='<div class="tsb"><h5>Popular questions</h5>'+qs.slice(0,6).map(function(q){return '<a class="q" href="'+q[1]+'">'+q[0]+'</a>';}).join('')+'</div>';
    var L=document.createElement('aside'); L.className='tsr'; L.setAttribute('aria-label','Article navigation');
    L.innerHTML='<div class="tsb"><h5>In this article</h5><div class="tsp"><i id="tsProg"></i></div><div class="tst">'+hs.map(function(h){return '<a href="#'+h.id+'">'+esc(h.textContent.trim())+'</a>';}).join('')+'</div></div>'+qhtml;
    var R=document.createElement('aside'); R.className='tsr'; R.setAttribute('aria-label','Space ETF data');
    R.innerHTML='<div class="tsb"><h5>Top space ETFs <a href="/#rankings">All</a></h5><div id="tsTop"><a class="row" href="/#rankings"><span>Loading live prices</span></a></div><a class="btn2" href="/#rankings">See the full rankings</a></div><div class="tsb"><h5>Biggest moves today</h5><div id="tsMov"></div></div><div class="tsb"><h5>Explore</h5><a class="q" href="/?cat=Space#rankings">Pure space ETFs</a><a class="q" href="/?cat=Aerospace%20%26%20Defense#rankings">Aerospace and defense ETFs</a><a class="q" href="/?cat=Income#rankings">Income ETFs</a><a class="q" href="/blog">All articles</a></div>';
    document.body.appendChild(L); document.body.appendChild(R);
    var inl=document.createElement('div'); inl.className='tsin';
    inl.innerHTML='<div class="g"><div class="tsb"><h5>Top space ETFs <a href="/#rankings">All</a></h5><div id="tsTop2"></div></div>'+qhtml+'</div>';
    var anchor=hs[2]||hs[hs.length-1]; if(anchor)anchor.parentNode.insertBefore(inl,anchor);
    function fitRail(rail,boxSel,rowSel,gap){
      var top=parseFloat(getComputedStyle(rail).top)||74,avail=window.innerHeight-top-gap,boxes=[].slice.call(rail.querySelectorAll(boxSel));
      boxes.forEach(function(b){b.style.display='';[].slice.call(b.querySelectorAll(rowSel)).forEach(function(a){a.style.display='';});});
      var guard=0;
      while(rail.scrollHeight>avail&&guard++<90){
        var vis=boxes.filter(function(b){return !b.hidden&&b.style.display!=='none';});if(!vis.length)break;
        var last=vis[vis.length-1],rows=[].slice.call(last.querySelectorAll(rowSel)).filter(function(a){return a.style.display!=='none';});
        if(rows.length>3)rows[rows.length-1].style.display='none';else if(vis.length>1)last.style.display='none';else if(rows.length>1)rows[rows.length-1].style.display='none';else break;
      }
      rail.style.maxHeight=avail+'px';
    }
    function place(){var rc=art.getBoundingClientRect(),w=Math.min(rc.width,820),cx=rc.left+rc.width/2;L.style.left=Math.max(12,cx-w/2-250-44)+'px';R.style.left=(cx+w/2+44)+'px';if(window.innerWidth>=1400){fitRail(L,'.tsb','a.row,a.q,.tst a',22);fitRail(R,'.tsb','a.row,a.q,.tst a',22);}}
    var links=[].slice.call(L.querySelectorAll('.tst a')),prog=L.querySelector('#tsProg');
    function onScroll(){
      var rc=art.getBoundingClientRect(),vh=window.innerHeight,show=rc.top<vh*0.35&&rc.bottom>vh*0.6;
      L.classList.toggle('show',show);R.classList.toggle('show',show);
      var done=Math.max(0,Math.min(1,(-rc.top+vh*0.3)/Math.max(1,rc.height)));prog.style.width=(done*100).toFixed(1)+'%';
      var cur=0;hs.forEach(function(h,i){if(h.getBoundingClientRect().top<140)cur=i;});
      links.forEach(function(a,i){a.classList.toggle('on',i===cur);});
    }
    place();onScroll();window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',function(){place();onScroll();});
    load().then(function(d){
      var rows=d.rows.filter(function(r){return r._cat==='Space'||r._cat==='Aerospace & Defense';}).sort(function(a,b){return b._aum-a._aum;});
      var top=rows.filter(function(r){return r._cat==='Space';}).slice(0,7);
      document.getElementById('tsTop').innerHTML=fundRows(top,7); var t2=document.getElementById('tsTop2'); if(t2)t2.innerHTML=fundRows(top,6);
      var mv=d.rows.filter(function(r){return r._chg!=null&&r._cat!=='Leveraged & Inverse';}).sort(function(a,b){return Math.abs(b._chg)-Math.abs(a._chg);});
      document.getElementById('tsMov').innerHTML=fundRows(mv,4)||'<a class="row" href="/#rankings"><span>See rankings</span></a>';
      place();
    }).catch(function(){});
  }
  function boot(){initSearch();covers();postCover();footer();rails();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
