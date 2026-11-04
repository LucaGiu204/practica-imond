/* EcoBottle AR — Dashboard estático.
 * Consume exclusivamente KPIs precalculados en SQL.
 * JavaScript selecciona datos y genera visualizaciones.
 * No calcula indicadores de negocio.
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
  
  // Datos finales calculados previamente en DuckDB.
  const state = {
    ventas: [],
    nps: [],
    usuarios: [],
    ranking: [],
    tax: 'with'
  };

  // Filtros del dashboard.
  const f = {
    period: 'Todo',
    channel: '',
    province: '',
    product: '',
    month: ''
  };

  const PATH = './data/';

  // Columnas que necesitamos de cada Mart.
  const sources = [
    ["mart_kpi_ventas.csv", [
      "periodo", "canal", "provincia", "producto",
      "pedidos", "ventas_con_iva", "ventas_sin_iva",
      "ticket_con_iva", "ticket_sin_iva"
    ]],

    ["mart_kpi_nps.csv", [
      "periodo", "canal", "respuestas",
      "promotores", "pasivos", "detractores",
      "nps", "porcentaje_promotores",
      "porcentaje_pasivos", "porcentaje_detractores"
    ]],

    ["mart_kpi_usuarios.csv", [
      "periodo", "usuarios_activos"
    ]],

    ["mart_kpi_ranking.csv", [
      "mes", "canal", "provincia", "producto",
      "unidades_vendidas", "ventas_producto", "ranking"
    ]]
  ];

  // Determina si un mes pertenece al período elegido.
  const monthInPeriod = (month) =>
    f.period === 'Todo' ||
    (f.period.length === 4 && month.startsWith(f.period + '-')) ||
    month === f.period;


  function readCSV(text, columns) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some(value => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    const [headers, ...data] = rows;

    if (!headers) {
      throw new Error("El archivo CSV está vacío");
    }

    const indexes = columns.map(name => {
      const index = headers.indexOf(name);

      if (index === -1) {
        throw new Error(`No se encontró la columna ${name}`);
      }

      return index;
    });

    return data.map(row =>
      indexes.map(index => row[index] ?? "")
    );
  }

  
  async function load() {
    try {
      // 1. Descargar los CSV de las cuatro Mart de KPIs.
      const responses = await Promise.all(
        sources.map(([file]) =>
          fetch(PATH + file, { cache: 'no-cache' })
        )
      );

      // Comprobar que todos los archivos estén disponibles.
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          throw new Error(
            `No se pudo cargar ${sources[i][0]} (HTTP ${responses[i].status})`
          );
        }
      }

      // 2. Leer y convertir los CSV a arreglos.
      const content = await Promise.all(
        responses.map(response => response.text())
      );

      [
        state.ventas,
        state.nps,
        state.usuarios,
        state.ranking
      ] = content.map((text, i) =>
        readCSV(text, sources[i][1])
      );

      if (!state.ventas.length) {
        throw new Error('La Mart de ventas está vacía.');
      }

      // 3. Preparar el selector de períodos.
      const periodos = new Set(
        state.ventas.map(row => row[0])
      );

      const años = [...periodos]
        .filter(p => /^\d{4}$/.test(p))
        .sort();

      const meses = [...periodos]
        .filter(p => /^\d{4}-\d{2}$/.test(p))
        .sort();

      const periodSelect = $('period-filter');

      for (const año of años) {
        periodSelect.add(new Option(`Año ${año}`, año));

        for (const mes of meses) {
          if (mes.startsWith(año + '-')) {
            periodSelect.add(
              new Option(monthLabel(mes), mes)
            );
          }
        }
      }

      f.period = 'Todo';
      periodSelect.value = f.period;

      // 4. Preparar los filtros de canal, provincia y producto.
      addOptions(
        'channel-filter',
        new Set(
          state.ventas
            .map(row => row[1])
            .filter(value => value !== 'Todos')
        )
      );

      addOptions(
        'province-filter',
        new Set(
          state.ventas
            .map(row => row[2])
            .filter(value => value !== 'Todas')
        )
      );

      addOptions(
        'product-filter',
        new Set(
          state.ventas
            .map(row => row[3])
            .filter(value => value !== 'Todos')
        )
      );

      // 5. Preparar el selector del ranking mensual.
      const mesesRanking = monthsSorted(
        state.ranking.map(row => row[0])
      );

      $('ranking-month').innerHTML = mesesRanking
        .map(mes =>
          `<option value="${esc(mes)}">${esc(monthLabel(mes))}</option>`
        )
        .join('');

      f.month = mesesRanking[mesesRanking.length - 1] || '';
      $('ranking-month').value = f.month;

      // 6. Mostrar la fuente de los datos.
      $('data-source-label').textContent =
        'Fuente: KPIs precalculados en SQL · DuckDB';

      // 7. Inicializar el dashboard.
      setupEvents();
      render();

      $('status-overlay').classList.add('hidden');

    } catch (err) {
      console.error(err);

      const overlay = $('status-overlay');
      overlay.querySelector('.status-box').classList.add('error');

      $('status-title').textContent =
        'No se pudieron cargar los datos';

      $('status-message').textContent =
        `${err.message} Revisá los CSV publicados en docs/data/.`;
    }
  }

  function addOptions(id, values){
    const el=$(id); [...values].filter(v=>v!==null&&v!==undefined&&String(v).trim()).sort((a,b)=>String(a).localeCompare(String(b),'es'))
      .forEach(v=>{const opt=document.createElement('option');opt.value=v;opt.textContent=v;el.appendChild(opt);});
  }
  
  function setupEvents() {

    // Detectar cambios en los filtros.
    const filtros = [
      ['period-filter', 'period'],
      ['channel-filter', 'channel'],
      ['province-filter', 'province'],
      ['product-filter', 'product']
    ];

    for (const [id, key] of filtros) {
      $(id).addEventListener('change', (event) => {
        f[key] = event.target.value;
        render();
      });
    }

    // Selector del mes para el ranking.
    $('ranking-month').addEventListener('change', (event) => {
      f.month = event.target.value;
      render();
    });

    // Restablecer filtros.
    $('clear-filters').addEventListener('click', () => {
      f.period = 'Todo';
      f.channel = '';
      f.province = '';
      f.product = '';
      f.month = '';

      for (const [id, value] of [
        ['period-filter', 'Todo'],
        ['channel-filter', ''],
        ['province-filter', ''],
        ['product-filter', '']
      ]) {
        $(id).value = value;
      }

      render();
    });

    // Activar o desactivar IVA.
    function tax(value) {
      state.tax = value;

      for (const [id, val] of [
        ['tax-with', 'with'],
        ['tax-without', 'without']
      ]) {
        $(id).classList.toggle('selected', val === value);
        $(id).setAttribute(
          'aria-pressed',
          String(val === value)
        );
      }

      render();
    }

    $('tax-with').addEventListener('click', () => tax('with'));
    $('tax-without').addEventListener('click', () => tax('without'));

    // Redibujar los gráficos cuando cambia el tamaño.
    window.addEventListener('resize', () => {
      clearTimeout(window.__resizeChart);
      window.__resizeChart = setTimeout(render, 150);
    });

    // Navegación lateral.
    for (const link of document.querySelectorAll('.nav-link')) {
      link.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(
          a => a.classList.remove('active')
        );
        link.classList.add('active');
      });
    }
  }

  
  function currentData() {

    // Valores que identifican los totales creados con CUBE.
    const canal = f.channel || 'Todos';
    const provincia = f.province || 'Todas';
    const producto = f.product || 'Todos';

    // Seleccionar la fila exacta del KPI de ventas.
    const ventas = state.ventas.find(row =>
      row[0] === f.period &&
      row[1] === canal &&
      row[2] === provincia &&
      row[3] === producto
    );

    // NPS: solamente período y canal.
    const nps = state.nps.find(row =>
      row[0] === f.period &&
      row[1] === canal
    );

    // Usuarios: solamente período.
    const usuarios = state.usuarios.find(row =>
      row[0] === f.period
    );

    // Datos mensuales ya calculados para los gráficos.
    const esMes = periodo => /^\d{4}-\d{2}$/.test(periodo);

    const ventasMensuales = state.ventas.filter(row =>
      esMes(row[0]) &&
      monthInPeriod(row[0]) &&
      row[1] === canal &&
      row[2] === provincia &&
      row[3] === producto
    ).sort((a, b) => a[0].localeCompare(b[0]));

    const npsMensual = state.nps.filter(row =>
      esMes(row[0]) &&
      monthInPeriod(row[0]) &&
      row[1] === canal
    ).sort((a, b) => a[0].localeCompare(b[0]));

    const usuariosMensuales = state.usuarios.filter(row =>
      esMes(row[0]) &&
      monthInPeriod(row[0])
    ).sort((a, b) => a[0].localeCompare(b[0]));

    // Ventas provinciales ya agregadas en SQL.
    const ventasProvincias = state.ventas.filter(row =>
      row[0] === f.period &&
      row[1] === canal &&
      row[2] !== 'Todas' &&
      row[3] === producto
    );

    // Ranking ya calculado por mes, canal y provincia.
    const ranking = state.ranking.filter(row =>
      monthInPeriod(row[0]) &&
      row[1] === canal &&
      row[2] === provincia
    );

    return {
      ventas,
      nps,
      usuarios,
      ventasMensuales,
      npsMensual,
      usuariosMensuales,
      ventasProvincias,
      ranking
    };
  }

  
  function render() {

    const {
      ventas,
      nps,
      usuarios,
      ventasMensuales,
      npsMensual,
      usuariosMensuales,
      ventasProvincias,
      ranking
    } = currentData();

    // Columnas con y sin IVA calculadas en SQL.
    const columnaVentas = state.tax === 'with' ? 5 : 6;
    const columnaTicket = state.tax === 'with' ? 7 : 8;

    const pedidos = ventas ? Number(ventas[4]) : 0;

    // KPIs principales: leer directamente sus valores.
    $('kpi-sales').textContent = ventas
      ? short(Number(ventas[columnaVentas]), true)
      : '—';

    $('kpi-ticket').textContent = ventas
      ? short(Number(ventas[columnaTicket]), true)
      : '—';

    $('kpi-users').textContent = usuarios
      ? short(Number(usuarios[1]))
      : '—';

    const valorNps = nps ? Number(nps[6]) : null;

    $('kpi-nps').textContent = valorNps === null
      ? '—'
      : `${valorNps > 0 ? '+' : ''}${oneDecimal(valorNps)}`;

    // Descripciones de los indicadores.
    const iva = state.tax === 'with'
      ? 'IVA incluido'
      : 'IVA excluido';

    $('kpi-sales-detail').textContent =
      `${numeric(pedidos)} pedidos válidos · ${iva}`;

    $('kpi-ticket-detail').textContent =
      `Por pedido · ${iva}`;

    $('kpi-nps-detail').textContent =
      `${numeric(nps ? Number(nps[2]) : 0)} respuestas · Período y canal`;

    const productoTexto = f.product
      ? `Pedidos con ${f.product}`
      : 'Todos los productos';

    $('filter-summary').textContent =
      `${numeric(pedidos)} pedidos · ${productoTexto}`;

    $('filter-compat').textContent =
      'NPS: período y canal · Usuarios: solo período';

    // Gráfico de ventas mensuales.
    drawLine(
      'sales-chart',
      ventasMensuales.map(row => [
        row[0],
        Number(row[columnaVentas])
      ]),
      value => short(value, true),
      { zero: true }
    );

    // Gráfico de ventas por provincia.
    const porProvincia = new Map(
      ventasProvincias.map(row => [
        row[2],
        Number(row[columnaVentas])
      ])
    );

    drawBars(porProvincia);

    // Gráfico de usuarios activos mensuales.
    drawLine(
      'users-chart',
      usuariosMensuales.map(row => [
        row[0],
        Number(row[1])
      ]),
      value => short(value),
      { zero: true }
    );

    // Tendencia mensual de NPS.
    drawLine(
      'nps-chart',
      npsMensual.map(row => [
        row[0],
        Number(row[6])
      ]),
      value => oneDecimal(value),
      { nps: true }
    );

    // Distribución NPS y ranking de productos.
    drawDonut(nps);
    drawProducts(ranking);
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
  
  function drawDonut(row) {

    const grupos = [
      ['Promotores', '#159777', 7],
      ['Pasivos', '#b5cfc1', 8],
      ['Detractores', '#edbc87', 9]
    ];

    const total = row ? Number(row[2]) : 0;

    $('nps-total').textContent = numeric(total);

    let inicio = 0;
    const segmentos = [];

    for (let i = 0; i < grupos.length; i++) {
      const [categoria, color, columna] = grupos[i];

      // Porcentaje calculado previamente en SQL.
      const porcentaje = row ? Number(row[columna]) : 0;

      // Solamente calculamos dónde dibujar el segmento.
      const fin = i === grupos.length - 1
        ? 100
        : inicio + porcentaje;

      segmentos.push(
        `${color} ${inicio.toFixed(3)}% ${fin.toFixed(3)}%`
      );

      inicio = fin;
    }

    $('nps-donut').style.background = total
      ? `conic-gradient(${segmentos.join(',')})`
      : '#e9efeb';

    $('nps-legend').innerHTML = grupos.map(
      ([categoria, color, columna]) => {

        const porcentaje = row
          ? Number(row[columna])
          : 0;

        return `
          <div class="legend-row">
            <i class="legend-dot" style="background:${color}"></i>
            ${esc(categoria)}
            <span>${oneDecimal(porcentaje)}%</span>
          </div>
        `;
      }
    ).join('');
  }

  
  function drawProducts(all) {

    // Meses disponibles según el período, canal y provincia.
    const meses = monthsSorted(
      all.map(row => row[0])
    );

    const selector = $('ranking-month');

    // Deshabilitar meses sin resultados.
    for (const option of selector.options) {
      option.disabled = !meses.includes(option.value);
    }

    // Elegir el último mes válido cuando corresponda.
    if (!meses.includes(f.month)) {
      f.month = meses[meses.length - 1] || '';
      selector.value = f.month;
    }

    // Seleccionar el ranking mensual ya calculado.
    const ranked = all
      .filter(row => row[0] === f.month)
      .sort((a, b) => Number(a[6]) - Number(b[6]));

    // Escala visual de las barras.
    const max = Math.max(
      1,
      ...ranked.map(row => Number(row[5]))
    );

    // El producto seleccionado se muestra conservando
    // su puesto original en el ranking del segmento.
    const visibles = f.product
      ? ranked.filter(row => row[3] === f.product)
      : ranked;

    if (!visibles.length) {
      $('product-ranking').innerHTML =
        '<div class="empty-state">No hay productos para estos filtros.</div>';
      return;
    }

    $('product-ranking').innerHTML = visibles.map(row => {

      const producto = row[3];
      const unidades = Number(row[4]);
      const ventas = Number(row[5]);
      const puesto = Number(row[6]);

      // Solamente se calcula el ancho visual de la barra.
      const ancho = Math.max(0, ventas / max * 100);

      return `
        <div class="product-row">
          <div class="rank-badge">${puesto}</div>

          <div>
            <div class="product-name">${esc(producto)}</div>
            <div class="product-units">
              ${numeric(unidades)} unidades · ${esc(monthLabel(f.month))}
            </div>

            <div class="product-progress">
              <div style="width:${ancho.toFixed(2)}%"></div>
            </div>
          </div>

          <div class="product-money">
            ${esc(money(ventas))}
          </div>
        </div>
      `;
    }).join('');
  }

  load();
})();
