/* TopSpaceETFs fund page: live quote + interactive price chart */
(function(){
  var sym=document.body.getAttribute('data-symbol'); if(!sym)return;
  var pct=function(n,d){return (n>=0?'+':'')+n.toFixed(d==null?2:d)+'%';};
  /* live quote from the shared sheet feed */
  if(window.TSE)TSE.load().then(function(d){
    var r=d.rows.filter(function(x){return x.Symbol===sym;})[0]; if(!r||!r._price)return;
    document.getElementById('qp').textContent='$'+r._price.toFixed(2);
    if(r._chg!=null){var c=document.getElementById('qc');c.textContent=pct(r._chg)+' today';c.className='c '+(r._chg>0?'up':r._chg<0?'dn':'fl');}
    document.getElementById('qt').textContent='Latest price, delayed up to 20 minutes';
  }).catch(function(){});
  /* tabs highlight */
  var tabs=[].slice.call(document.querySelectorAll('#tabs a'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){tabs.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id);});}});},{rootMargin:'-120px 0px -70% 0px'});
    tabs.forEach(function(a){var s=document.querySelector(a.getAttribute('href'));if(s)io.observe(s);});
  }
  /* chart */
  var box=document.getElementById('chart'),tip=document.getElementById('tip'),stat=document.getElementById('chartStat'),H=[],range='1Y';
  function slice(){
    if(!H.length)return [];
    var last=new Date(H[H.length-1][0]),from=new Date(last);
    if(range==='1M')from.setMonth(from.getMonth()-1);else if(range==='3M')from.setMonth(from.getMonth()-3);else if(range==='6M')from.setMonth(from.getMonth()-6);
    else if(range==='YTD')from=new Date(last.getFullYear()-1,11,31);else if(range==='1Y')from.setFullYear(from.getFullYear()-1);else if(range==='5Y')from.setFullYear(from.getFullYear()-5);else from=new Date(0);
    var f=from.toISOString().slice(0,10),s=H.filter(function(p){return p[0]>=f;});
    return s.length>1?s:H;
  }
  function draw(){
    var s=slice(); if(s.length<2)return;
    var W=box.clientWidth-12,Hh=box.clientHeight-8,l=8,r=58,t=12,b=26;
    var lo=Infinity,hi=-Infinity; s.forEach(function(p){if(p[1]<lo)lo=p[1];if(p[1]>hi)hi=p[1];});
    var pad=(hi-lo)*0.08||1; lo-=pad; hi+=pad;
    var X=function(i){return l+(W-l-r)*i/(s.length-1);},Y=function(v){return t+(Hh-t-b)*(1-(v-lo)/(hi-lo));};
    var up=s[s.length-1][1]>=s[0][1],col=up?'#34d399':'#f87171',d='',g='';
    s.forEach(function(p,i){d+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(p[1]).toFixed(1);});
    for(var k=0;k<=4;k++){var v=lo+(hi-lo)*k/4,y=Y(v);g+='<line x1="'+l+'" x2="'+(W-r)+'" y1="'+y+'" y2="'+y+'" stroke="#221d38"/><text x="'+(W-r+8)+'" y="'+(y+4)+'" fill="#a8a3bd" font-size="11" font-family="JetBrains Mono,monospace">$'+v.toFixed(v<10?2:v<100?1:0)+'</text>';}
    [0,Math.floor((s.length-1)/2),s.length-1].forEach(function(i,n){var dt=new Date(s[i][0]+'T12:00:00');g+='<text x="'+X(i)+'" y="'+(Hh-6)+'" fill="#a8a3bd" font-size="11" text-anchor="'+(n===0?'start':n===2?'end':'middle')+'">'+dt.toLocaleDateString('en-US',{month:'short',day:s.length<400?'numeric':undefined,year:'numeric'})+'</text>';});
    box.querySelector('svg')&&box.removeChild(box.querySelector('svg'));
    var svg='<svg viewBox="0 0 '+W+' '+Hh+'" preserveAspectRatio="none"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".28"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'+g+'<path d="'+d+'L'+X(s.length-1)+' '+(Hh-b)+'L'+l+' '+(Hh-b)+'Z" fill="url(#cg)"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/><line id="ch" y1="'+t+'" y2="'+(Hh-b)+'" stroke="#7d7896" stroke-dasharray="3 3" style="display:none"/><circle id="cd" r="4" fill="'+col+'" stroke="#0f0d1c" stroke-width="2" style="display:none"/></svg>';
    box.insertAdjacentHTML('beforeend',svg);
    var chg=(s[s.length-1][1]/s[0][1]-1)*100;
    stat.innerHTML='<b class="'+(chg>=0?'up':'dn')+'">'+pct(chg,1)+'</b> over this period · High $'+(hi-pad).toFixed(2)+' · Low $'+(lo+pad).toFixed(2);
    var sv=box.querySelector('svg'),line=sv.querySelector('#ch'),dot=sv.querySelector('#cd');
    function move(ev){
      var rc=sv.getBoundingClientRect(),cx=(ev.touches?ev.touches[0].clientX:ev.clientX)-rc.left,i=Math.round((cx/rc.width*W-l)/(W-l-r)*(s.length-1));
      i=Math.max(0,Math.min(s.length-1,i)); var p=s[i],x=X(i),y=Y(p[1]);
      line.setAttribute('x1',x);line.setAttribute('x2',x);line.style.display='';dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.style.display='';
      var c=(p[1]/s[0][1]-1)*100;
      tip.innerHTML=new Date(p[0]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' · $'+p[1].toFixed(2)+' <span class="'+(c>=0?'up':'dn')+'">'+pct(c,1)+'</span>';
      tip.style.display='block'; var tx=x/W*rc.width+14; if(tx+tip.offsetWidth>rc.width-10)tx=x/W*rc.width-tip.offsetWidth-14; tip.style.left=tx+'px'; tip.style.top='10px';
    }
    sv.addEventListener('mousemove',move);sv.addEventListener('touchmove',move,{passive:true});
    sv.addEventListener('mouseleave',function(){line.style.display='none';dot.style.display='none';tip.style.display='none';});
  }
  document.querySelectorAll('#rng button').forEach(function(bt){bt.addEventListener('click',function(){range=bt.dataset.r;document.querySelectorAll('#rng button').forEach(function(x){x.classList.toggle('on',x===bt);});draw();});});
  fetch('/data/etf/'+sym+'.json').then(function(r){return r.json();}).then(function(d){H=d.hist||[];if(H.length<260){range='MAX';document.querySelectorAll('#rng button').forEach(function(x){x.classList.toggle('on',x.dataset.r==='MAX');});}draw();}).catch(function(){box.innerHTML='<p style="padding:30px;color:#a8a3bd">Chart data is not available right now.</p>';});
  var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(draw,150);});
})();
