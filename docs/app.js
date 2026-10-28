/* EcoBottle AR — Dashboard estático.
 * SOLO consume JSON exportados desde Data Marts (docs/data/).
 * No lee CSV originales ni fuentes transaccionales.
 * Agregaciones de presentación permiten filtros interactivos sin backend.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => new Intl.NumberFormat('es-AR', {style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n || 0);
  const numeric = (n) => new Intl.NumberFormat('es-AR', {maximumFractionDigits:0}).format(n || 0);
  const oneDecimal = (n) => new Intl.NumberFormat('es-AR', {maximumFractionDigits:1}).format(n || 0);
  const short = (n, currency=false) => {
    const a=Math.abs(n||0), v=a>=1e9?[n/1e9,' mil M']:a>=1e6?[n/1e6,' M']:a>=1e3?[n/1e3,' mil']:[n,''];
    return (currency?'$ ':'') + oneDecimal(v[0]) + v[1];
  };
  const monthsSorted = (values) => [...new Set(values)].sort();
  const monthLabel = (month) => {
    const [y,m] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('es-AR',{month:'short', year:'2-digit'}).format(new Date(y,m-1,1)).replace('.','');
  };
  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {ventas:[],nps:[],actividad:[],productos:[],ranking:[],tax:'with'};
  const f = {from:'',to:'',channel:'',province:'',product:'',month:''};
  const PATH = './data/';
  const allowedFiles = ['ventas','nps','actividad','detalle_productos','ranking_sql'];
  const keyFrom = (d)=>d.slice(0,7);
  const isInDates = (day)=> (!f.from||day>=f.from) && (!f.to||day<=f.to);
  const taxCol = ()=> state.tax==='with'?5:6;

  async function load(){
    try{
      const response=await Promise.all(allowedFiles.map(name=>fetch(PATH+name+'.json',{cache:'no-cache'})));
      for(let i=0;i<response.length;i++)if(!response[i].ok)throw new Error(`No pude abrir docs/data/${allowedFiles[i]}.json (HTTP ${response[i].status}).`);
      const content=await Promise.all(response.map(r=>r.json()));
      [state.ventas,state.nps,state.actividad,state.productos,state.ranking]=content;
      const allDates=state.ventas.map(v=>v[1]).filter(Boolean).sort();
      if(!allDates.length)throw new Error('La Mart de ventas no contiene registros. Revisá la exportación SQL.');
      f.from=allDates[0];f.to=allDates[allDates.length-1];
      $('date-from').min=f.from;$('date-from').max=f.to;$('date-from').value=f.from;
      $('date-to').min=f.from;$('date-to').max=f.to;$('date-to').value=f.to;
      addOptions('channel-filter',new Set(state.ventas.map(v=>v[3])));
      addOptions('province-filter',new Set(state.ventas.map(v=>v[4])));
      addOptions('product-filter',new Set(state.productos.map(v=>v[5])));
      const months=monthsSorted(state.ventas.map(v=>v[2]));
      $('ranking-month').innerHTML=months.map(m=>`<option value="${esc(m)}">${esc(monthLabel(m))}</option>`).join('');
      f.month=months[months.length-1];$('ranking-month').value=f.month;
      const label=$('data-source-label');
      label.textContent=`Fuente: ${numeric(state.ventas.length)} pedidos · Datos del DW`;
      setupEvents();
      render();
      $('status-overlay').classList.add('hidden');
    }catch(err){
      console.error(err);
      const overlay=$('status-overlay');overlay.querySelector('.status-box').classList.add('error');
      $('status-title').textContent='Faltan los datos publicados';
      $('status-message').textContent=`${err.message} Ejecutá primero python run_sql.py, luego python export_dashboard.py, y subí docs/data/ al repositorio.`;
    }
  }
  function addOptions(id, values){
    const el=$(id); [...values].filter(v=>v!==null&&v!==undefined&&String(v).trim()).sort((a,b)=>String(a).localeCompare(String(b),'es'))
      .forEach(v=>{const opt=document.createElement('option');opt.value=v;opt.textContent=v;el.appendChild(opt);});
  }
  function setupEvents(){
    [['date-from','from'],['date-to','to'],['channel-filter','channel'],['province-filter','province'],['product-filter','product']].forEach(([id,key])=>{
      $(id).addEventListener('change',e=>{f[key]=e.target.value;render();});
    });
    $('ranking-month').addEventListener('change',e=>{f.month=e.target.value;render();});
    $('clear-filters').addEventListener('click',()=>{
      f.from=$('date-from').min;f.to=$('date-to').max;f.channel='';f.province='';f.product='';
      for(const [id,value] of [['date-from',f.from],['date-to',f.to],['channel-filter',''],['province-filter',''],['product-filter','']])$(id).value=value;
      render();
    });
    function tax(to){state.tax=to;for(const [id,val] of [['tax-with','with'],['tax-without','without']]){
      $(id).classList.toggle('selected',val===to);$(id).setAttribute('aria-pressed',String(val===to));
    }render();}
    $('tax-with').addEventListener('click',()=>tax('with'));$('tax-without').addEventListener('click',()=>tax('without'));
    window.addEventListener('resize',()=>{clearTimeout(window.__resizeChart);window.__resizeChart=setTimeout(render,150);});
    for(const link of document.querySelectorAll('.nav-link'))link.addEventListener('click',()=>{
      document.querySelectorAll('.nav-link').forEach(a=>a.classList.remove('active'));link.classList.add('active');
    });
  }
  function currentData(){
    const prodFilter = (r) => isInDates(r[1]) && (!f.channel||r[3]===f.channel) && (!f.province||r[4]===f.province);
    const productOrders=f.product?new Set(state.productos.filter(r=>prodFilter(r) && r[5]===f.product).map(r=>String(r[0]))):null;
    const ventas=state.ventas.filter(r=>isInDates(r[1]) && (!f.channel||r[3]===f.channel) && (!f.province||r[4]===f.province) && (!productOrders||productOrders.has(String(r[0]))));
    const nps=state.nps.filter(r=>isInDates(r[0]) && (!f.channel||r[2]===f.channel));
    const actividad=state.actividad.filter(r=>isInDates(r[0]));
    const productos=state.productos.filter(r=>prodFilter(r));
    return {ventas,nps,actividad,productos};
  }
  function render(){
    const {ventas,nps,actividad,productos}=currentData();
    const total=ventas.reduce((acc,v)=>acc+Number(v[taxCol()]),0);
    const users=new Set(actividad.map(v=>v[2])).size;
    const npsValue=nps.length?nps.reduce((acc,v)=>acc+Number(v[3]),0)/nps.length:null;
    $('kpi-sales').textContent=short(total,true);
    $('kpi-users').textContent=short(users);
    $('kpi-ticket').textContent=ventas.length?short(total/ventas.length,true):'—';
    $('kpi-nps').textContent=npsValue===null?'—':`${npsValue>0?'+':''}${oneDecimal(npsValue)}`;
    $('kpi-sales-detail').textContent=`${numeric(ventas.length)} pedidos válidos · ${state.tax==='with'?'IVA incluido':'IVA excluido'}`;
    $('kpi-ticket-detail').textContent=`Por pedido · ${state.tax==='with'?'IVA incluido':'IVA excluido'}`;
    $('kpi-nps-detail').textContent=`${numeric(nps.length)} respuestas · Solo fecha y canal`;
    const productText=f.product?`Pedidos con ${f.product}`:'Todos los productos';
    $('filter-summary').textContent=`${numeric(ventas.length)} pedidos · ${productText}`;
    $('filter-compat').textContent=(f.province||f.product)?'Provincia/producto no se aplican a NPS ni a actividad web.':'NPS admite fecha y canal; actividad web solo fecha.';

    const salesByMonth=new Map();
    for(const r of ventas){const m=r[2];salesByMonth.set(m,(salesByMonth.get(m)||0)+Number(r[taxCol()]));}
    drawLine('sales-chart', [...salesByMonth].sort(([a],[b])=>a.localeCompare(b)), (v)=>short(v,true), {zero:true, type:'money'});
    const byProvince=new Map();for(const r of ventas){byProvince.set(r[4],(byProvince.get(r[4])||0)+Number(r[taxCol()]));}
    drawBars(byProvince);
    const webByMonth=new Map();for(const r of actividad){const key=r[1];if(!webByMonth.has(key))webByMonth.set(key,new Set());webByMonth.get(key).add(r[2]);}
    drawLine('users-chart',[...webByMonth].sort(([a],[b])=>a.localeCompare(b)).map(([m,set])=>[m,set.size]),v=>short(v),{zero:true});
    const npsByMonth=new Map();for(const r of nps){const m=r[1];if(!npsByMonth.has(m))npsByMonth.set(m,[0,0]);const v=npsByMonth.get(m);v[0]+=Number(r[3]);v[1]++;}
    drawLine('nps-chart',[...npsByMonth].sort(([a],[b])=>a.localeCompare(b)).map(([m,[sum,count]])=>[m,sum/count]),v=>oneDecimal(v),{nps:true});
    drawDonut(nps);
    drawProducts(productos);
  }
  function drawLine(id,values,formatter,options={}){
    const root=$(id);
    if(!values.length){root.innerHTML='<div class="empty-state">No hay datos para estos filtros.</div>';return;}
    const W=900,H=270, L=66,R=15,T=18,B=42, pw=W-L-R,ph=H-T-B;
    const nums=values.map(([,v])=>Number(v));let min=Math.min(...nums),max=Math.max(...nums);
    if(options.zero)min=0;
    if(options.nps){min=Math.max(-100,Math.floor((min-10)/10)*10);max=Math.min(100,Math.ceil((max+10)/10)*10);}
    if(min===max){min=options.zero?0:min-1;max=max+1;}
    if(!options.nps)max+=(max-min)*.12;
    const x=i=>L+(values.length===1?pw/2:i*pw/(values.length-1));
    const y=v=>T+ph-(v-min)/(max-min)*ph;
    let grid='',ticks='';
    for(let i=0;i<=4;i++){const v=min+(max-min)*i/4,yy=y(v);
      grid+=`<line class="svg-grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/>`;
      ticks+=`<text class="svg-axis" text-anchor="end" x="${L-11}" y="${yy+4}">${esc(formatter(v))}</text>`;
    }
    const stride=Math.max(1,Math.ceil(values.length/6));
    values.forEach(([m],i)=>{if(i%stride===0||i===values.length-1){ticks+=`<text class="svg-axis" x="${x(i)}" y="${H-13}" text-anchor="middle">${esc(monthLabel(m))}</text>`;}});
    const pts=values.map(([,v],i)=>[x(i),y(Number(v))]);
    const line=pts.map(([xx,yy],i)=>(i?'L':'M')+xx.toFixed(1)+','+yy.toFixed(1)).join(' ');
    const area=line+` L ${pts[pts.length-1][0].toFixed(1)},${(T+ph).toFixed(1)} L ${pts[0][0].toFixed(1)},${(T+ph).toFixed(1)} Z`;
    const dots=pts.map(([xx,yy],i)=>`<circle class="svg-dot" cx="${xx}" cy="${yy}" r="3.1"><title>${esc(monthLabel(values[i][0]))}: ${esc(formatter(values[i][1]))}</title></circle>`).join('');
    root.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="presentation" preserveAspectRatio="none">${grid}${ticks}<path class="svg-fill" d="${area}"/><path class="svg-line" d="${line}"/>${dots}</svg>`;
  }
  function drawBars(map){
    const el=$('province-bars');const rows=[...map].sort((a,b)=>b[1]-a[1]);
    if(!rows.length){el.innerHTML='<div class="empty-state">No hay ventas para estos filtros.</div>';return;}
    const max=Math.max(...rows.map(r=>r[1]),1);
    el.innerHTML=rows.map(([name,value])=>`<div class="bar-row"><div class="bar-label"><span>${esc(name)}</span><strong>${esc(short(value,true))}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,value/max*100).toFixed(2)}%"></div></div></div>`).join('');
  }
  function drawDonut(rows){
    const groups=[['Promotores','#159777'],['Pasivos','#b5cfc1'],['Detractores','#edbc87']];
    const counts=new Map(groups.map(([g])=>[g,0]));rows.forEach(r=>counts.set(r[4],(counts.get(r[4])||0)+1));
    const total=rows.length;$('nps-total').textContent=numeric(total);
    let start=0;const parts=[];
    for(const [category,color] of groups){const frac=total?(counts.get(category)||0)*100/total:0;parts.push(`${color} ${start.toFixed(3)}% ${(start+frac).toFixed(3)}%`);start+=frac;}
    $('nps-donut').style.background=total?`conic-gradient(${parts.join(',')})`:'#e9efeb';
    $('nps-legend').innerHTML=groups.map(([category,color])=>{
      const c=counts.get(category)||0;return `<div class="legend-row"><i class="legend-dot" style="background:${color}"></i>${category}<span>${total?oneDecimal(c/total*100):'0'}%</span></div>`;
    }).join('');
  }
  function drawProducts(all){
    const months=monthsSorted(all.map(r=>r[2]));
    const current=$('ranking-month');const allMonths=Array.from(current.options).map(o=>o.value);
    for(const opt of current.options)opt.disabled=!months.includes(opt.value);
    if(!months.includes(f.month)&&months.length){f.month=months[months.length-1];current.value=f.month;}
    const monthRows=all.filter(r=>r[2]===f.month),agg=new Map();
    for(const r of monthRows){const key=r[5];if(!agg.has(key))agg.set(key,{units:0,sales:0});const v=agg.get(key);v.units+=Number(r[6]);v.sales+=Number(r[7]);}
    let ranked=[...agg].sort((a,b)=>b[1].sales-a[1].sales);
    if(!ranked.length){$('product-ranking').innerHTML='<div class="empty-state">No hay productos en este período.</div>';return;}
    const max=Math.max(...ranked.map(r=>r[1].sales),1);
    let lastSale=null,lastRank=0;
    const baseline = (!f.channel && !f.province && !f.product && f.from === $('date-from').min && f.to === $('date-to').max)
      ? new Map(state.ranking.filter(r => r[0]===f.month).map(r => [r[1], Number(r[4])]))
      : null;
    $('product-ranking').innerHTML=ranked.map(([name,val],i)=>{
      const rank=(lastSale===null||Math.abs(val.sales-lastSale)>0.0001)?i+1:lastRank;
      lastRank=rank;lastSale=val.sales;
      return {name,val,rank:baseline?.get(name) ?? rank};
    }).filter(row=>!f.product || row.name===f.product).map(({name,val,rank})=>
      `<div class="product-row"><div class="rank-badge">${rank}</div><div><div class="product-name">${esc(name)}</div><div class="product-units">${numeric(val.units)} unidades · ${esc(monthLabel(f.month))}</div><div class="product-progress"><div style="width:${Math.max(0,val.sales/max*100).toFixed(2)}%"></div></div></div><div class="product-money">${esc(money(val.sales))}</div></div>`
    ).join('');
  }
  load();
})();
