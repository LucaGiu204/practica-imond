# EcoBottle AR — Data Warehouse y dashboard comercial

**Trabajo práctico | Introducción al Marketing Online y los Negocios Digitales**

Proyecto de inteligencia comercial para **EcoBottle AR**, una empresa ficticia que comercializa las botellas reutilizables *Classic A Bottle* y *Sport B Bottle* a través de un canal online y tiendas físicas. Partimos de archivos CSV, construimos un **Data Warehouse dimensional con enfoque Kimball** en DuckDB, definimos seis indicadores de negocio en SQL y publicamos un dashboard interactivo mediante **GitHub Pages**.

### [🌐 Abrir el dashboard interactivo](https://lucagiu204.github.io/practica-imond/)

**El dashboard puede consultarse directamente desde el navegador. No es necesario ejecutar Python, instalar DuckDB ni descargar el repositorio para visualizarlo.**

Enlaces del proyecto:

- [Repositorio de este trabajo](https://github.com/LucaGiu204/practica-imond)
- [Consigna del trabajo práctico](https://docs.google.com/document/d/15RNP3FVqLjO4jzh80AAkK6mUR5DOLqPxLjQxqvdzrYg/edit?usp=sharing)
- [Repositorio base proporcionado por el profesor](https://github.com/AugustoCarmona/practica-imond)
- [Diagrama generado del modelo estrella](./dw/modelo_estrella.md)
- [DER de los datos originales](./assets/DER.png)

**Estado del proyecto:** implementados el modelo dimensional (seis dimensiones y seis hechos), las consultas de los seis KPIs, cinco Data Marts y el dashboard web publicado. Los CSV del DW y los CSV consumidos por GitHub Pages están versionados en el repositorio.

## 1. Arquitectura de la solución

Separamos **origen**, **transformación**, **modelo analítico** y **presentación**. Esta separación es central para el trabajo: **las Data Marts y el dashboard no consultan directamente `raw/`**.

```text
13 CSV originales (raw/)
          |
          v
run_sql.py + DuckDB
          |
          +--> sql/01_dimensiones.sql         --> 6 dimensiones
          |
          +--> sql/02_hechos.sql              --> 6 hechos
          |
          +--> sql/03_consultas.sql           --> 6 KPIs y comprobaciones
          |
          +--> sql/04_marts.sql               --> 4 Data Marts
          |
          +--> sql/05_mart_detalle_productos.sql --> 5.ª Data Mart
          |
          v
warehouse.duckdb (base local regenerable)
          |
          +--> dw/*.csv                       --> dimensiones, hechos y Mart
          |
          +--> dw/modelo_estrella.md          --> diagrama Mermaid
          |
          +--> docs/data/mart_*.csv           --> copias de las cinco Mart
                                                     |
                                                     v
                                             GitHub Pages (/docs)
                                             HTML + CSS + JavaScript
                                             (lee solo CSV de Mart)
```

**Decisiones de diseño:**

- **RAW:** los 13 CSV originales permanecen sin modificaciones en `raw/`. `run_sql.py` los registra como vistas `raw.nombre_tabla` para construir el DW.
- **Modelo dimensional:** seis dimensiones (producto, canal, cliente, fecha, provincia y tienda) y seis tablas de hechos. Las relaciones y restricciones se documentan en el [diagrama generado](./dw/modelo_estrella.md).
- **Reglas de negocio:** se definen en SQL; para ventas se incluyen pedidos con estado `PAID` o `FULFILLED`.
- **Data Marts:** las cinco tablas `mart_*` consultan **exclusivamente hechos y dimensiones** ya construidos, no archivos RAW.
- **Publicación:** `run_sql.py` exporta todas las tablas a `dw/` y copia **solo las cinco Mart** a `docs/data/`. GitHub Pages publica la carpeta `docs/`.
- **Visualización:** `docs/app.js` lee los CSV publicados mediante `fetch()`, interpreta las columnas y presenta gráficos y KPIs. Algunas sumas, promedios y recuentos distintos se calculan en el navegador al cambiar filtros; el ranking mensual de base también está calculado en SQL. No se utiliza un servidor de base de datos en producción.

### Estructura del repositorio

```text
practica-imond/
├── raw/                            # 13 CSV originales
├── sql/
│   ├── 01_dimensiones.sql          # 6 dimensiones
│   ├── 02_hechos.sql               # 6 hechos
│   ├── 03_consultas.sql            # 6 KPIs y verificaciones
│   ├── 04_marts.sql                # 4 Data Marts
│   └── 05_mart_detalle_productos.sql # Mart de productos por pedido
├── dw/
│   ├── dim_*.csv                   # Dimensiones exportadas
│   ├── fact_*.csv                  # Hechos exportados
│   ├── mart_*.csv                  # 5 Data Marts exportadas
│   └── modelo_estrella.md          # Diagrama autogenerado
├── docs/
│   ├── index.html                  # Estructura del dashboard
│   ├── styles.css                  # Diseño responsive
│   ├── app.js                      # Lectura de CSV y visualizaciones
│   └── data/
│       ├── mart_ventas.csv
│       ├── mart_nps.csv
│       ├── mart_actividad_web.csv
│       ├── mart_detalle_productos.csv
│       └── mart_ranking_productos.csv
├── assets/                         # DER del origen
├── generator/                      # Generador del repositorio base
├── run_sql.py                      # Único programa de construcción y exportación
├── requirements.txt               # Dependencia de DuckDB
├── .gitignore
└── README.md
```

**Versionado:** los CSV de `raw/`, `dw/` y `docs/data/` se incluyen en Git para permitir la auditoría y el funcionamiento autónomo de GitHub Pages. El archivo local `warehouse.duckdb` se excluye mediante `.gitignore`, porque puede reconstruirse.

## 2. Datos y alcance

- **Empresa:** EcoBottle AR; dos productos, canales `ONLINE` y `OFFLINE`, cuatro provincias: Buenos Aires, Córdoba, Santa Fe y Mendoza.
- **Período de análisis:** desde el 01/01/2024 hasta el 30/09/2025; corte de los datos originales al 30/09/2025.
- **Moneda:** pesos argentinos (`ARS`). Los precios de lista se expresan sin IVA.
- **Importes:** `line_total = quantity × unit_price − discount_amount`; `subtotal = SUM(line_total)`; `tax_amount = 21 % del subtotal`; `total_amount = subtotal + tax_amount + shipping_fee`.
- **Tablas de origen:** `address`, `channel`, `customer`, `nps_response`, `payment`, `product`, `product_category`, `province`, `sales_order`, `sales_order_item`, `shipment`, `store` y `web_session`.
- **Valores faltantes:** los campos vacíos de los CSV se interpretan como `NULL` al cargar los datos.

![Diagrama entidad–relación de las fuentes originales](./assets/DER.png)

El [modelo estrella generado](./dw/modelo_estrella.md) muestra columnas, tipos y relaciones efectivamente declaradas en DuckDB.

## 3. Diccionario de datos

Las etiquetas **PK** y **FK** describen las restricciones declaradas en SQL. Los `order_id` utilizados para vincular hechos no necesariamente están definidos como claves foráneas formales a `fact_sales_order`.

### 3.1 Dimensiones

| Tabla | Identificación | Atributos principales |
|---|---|---|
| `dim_product` | `product_key INTEGER` **PK**; `product_id INTEGER` | `sku`, `name`, `category`, `family`, `list_price DECIMAL(12,2)`. |
| `dim_channel` | `channel_key INTEGER` **PK**; `channel_id INTEGER UNIQUE` | `code`, `name`. |
| `dim_customer` | `customer_key INTEGER` **PK**; `customer_id INTEGER UNIQUE` | `email`, `first_name`, `last_name`, `phone`, `status`, `created_at`. |
| `dim_date` | `date_key INTEGER` **PK** (`YYYYMMDD`); `full_date DATE UNIQUE` | `year`, `month`, `day`, `quarter`, `year_month` (`YYYY-MM`). |
| `dim_province` | `province_key INTEGER` **PK**; `province_id INTEGER UNIQUE` | `name`, `code`. |
| `dim_store` | `store_key INTEGER` **PK**; `store_id INTEGER UNIQUE` | `name`, `address_id` (referencia operativa al origen). |

**Origen:** las dimensiones se cargan a partir de las fuentes RAW en `01_dimensiones.sql`; `dim_product` incorpora la jerarquía de categorías. `dim_date` se genera para los días del período de análisis.

### 3.2 Tablas de hechos

| Tabla | Granularidad | Identificación, relaciones y medidas |
|---|---|---|
| `fact_sales_order` | Un pedido | `order_id` **PK**; claves a fecha, cliente, canal, provincia y tienda; `order_date`, `status`, `currency_code`, `subtotal`, `tax_amount`, `shipping_fee`, `discount_total`, `total_amount`. |
| `fact_sales_order_item` | Una línea de pedido | `order_item_id` **PK**; `order_id`, claves a producto, fecha, cliente, canal, provincia y tienda; `quantity`, `unit_price`, `discount_amount`, `line_total`, `status`. |
| `fact_payment` | Un registro de pago | `payment_id` **PK**; `order_id`, claves a fecha de pago, cliente, canal, provincia y tienda; `method`, `status`, `amount`, `paid_at`, `transaction_ref`. |
| `fact_shipment` | Un envío | `shipment_id` **PK**; `order_id`, claves a fechas de despacho y entrega, cliente, canal, provincia y tienda; `carrier`, `tracking_number`, `status`, `shipped_at`, `delivered_at`. |
| `fact_web_session` | Una sesión web | `session_id` **PK**; claves a fecha y cliente; `started_at`, `ended_at`, `source`, `device`. El cliente puede ser `NULL`. |
| `fact_nps_response` | Una respuesta NPS | `nps_id` **PK**; claves a fecha, cliente y canal; `score` (0–10), `comment`. El cliente puede ser `NULL`. |

Las claves foráneas a dimensiones son enteras; las claves operativas de eventos son `BIGINT` en el modelo. Algunas referencias se permiten nulas cuando el evento no cuenta con ese dato.

### 3.3 Data Marts

| Tabla | Una fila representa… | Principales columnas | Uso en el dashboard |
|---|---|---|---|
| `mart_ventas` | Un pedido válido | `order_id`, `fecha`, `mes`, `canal`, `provincia`, `ventas_con_iva`, `ventas_sin_iva` | Ventas, ticket promedio, serie temporal y provincias. |
| `mart_nps` | Una encuesta NPS | `nps_id`, `fecha`, `mes`, `canal`, `score`, `categoria_nps`, `aporte_nps` | NPS, tendencia y distribución de promotores/pasivos/detractores. |
| `mart_actividad_web` | Una sesión | `fecha`, `mes`, `session_id`, `customer_key`, `source`, `device`, `usuario_analitico_id` | Usuarios activos estimados y evolución mensual. |
| `mart_detalle_productos` | Una línea de un pedido válido | `order_item_id`, `order_id`, `fecha`, `mes`, `canal`, `provincia`, `producto`, `unidades`, `ventas_producto` | Filtro de pedidos por producto y análisis de importes de líneas. |
| `mart_ranking_productos` | Un producto por mes | `mes`, `producto`, `unidades_vendidas`, `ventas_producto`, `ranking` | Ranking mensual calculado con `RANK()` en SQL. |

**Por qué existe `mart_detalle_productos`:** `mart_ventas` contiene una fila por **pedido**, mientras que el detalle contiene una fila por **línea de producto**. Un pedido puede tener más de una línea; sumar el total del pedido después de unir ambas tablas directamente duplicaría facturación. Por eso el dashboard utiliza `order_id` para localizar los pedidos que contienen un producto y cuenta cada pedido una sola vez. El importe de las líneas de ese producto es una medida diferente del importe total de los pedidos que lo incluyen.

### 3.4 Dominios y supuestos

| Campo o criterio | Regla aplicada |
|---|---|
| Estados de pedido | `CREATED`, `PAID`, `FULFILLED`, `CANCELLED`, `REFUNDED`. **Solo `PAID` y `FULFILLED` se consideran ventas.** |
| Estado de cliente | `A` (activo) e `I` (inactivo); las ventas históricas se conservan aunque el cliente cambie de estado. |
| Canales | `ONLINE`, `OFFLINE` (sus nombres visibles provienen de `dim_channel`). |
| Medios de pago | `CASH`, `CARD`, `TRANSFER`, `GATEWAY`. |
| Estado de pago | `PENDING`, `PAID`, `FAILED`, `REFUNDED`. |
| Estado de envío | `READY`, `SHIPPED`, `DELIVERED`, `CANCELLED`. |
| Escala NPS | Detractores: 0–6; pasivos: 7–8; promotores: 9–10. |
| Provincia | Se relaciona durante la construcción de los hechos y se presenta como **Sin provincia** si falta. |
| Fechas opcionales | El pago, envío o entrega pueden no haberse producido; una misma `dim_date` se utiliza para distintos roles de fecha. |
| Claves subrogadas | `ROW_NUMBER()` ordenado por el identificador original, salvo fecha (`YYYYMMDD`). |
| IVA, descuentos y envío | El subtotal incluye los descuentos de las líneas. `ventas_sin_iva = total_amount - tax_amount`, por lo que **mantiene el costo de envío**. No equivale simplemente a `total_amount / 1.21`. |
| Usuarios anónimos | Una identidad analítica por sesión anónima. No equivale necesariamente a personas únicas. |
| Ranking mensual | `RANK()` por mes, orden descendente por `SUM(line_total)`; los empates comparten puesto. |

## 4. Indicadores y definiciones de negocio

Los seis indicadores solicitados están definidos y comprobados en [`sql/03_consultas.sql`](./sql/03_consultas.sql). Las Mart de [`sql/04_marts.sql`](./sql/04_marts.sql) y [`sql/05_mart_detalle_productos.sql`](./sql/05_mart_detalle_productos.sql) materializan datos listos para visualizar.

| Indicador | Definición | Fuente del dashboard |
|---|---|---|
| **Ventas totales** | `SUM(total_amount)` de pedidos `PAID/FULFILLED`; sin IVA se resta `tax_amount`. | `mart_ventas`, sumando `ventas_con_iva` o `ventas_sin_iva`. |
| **Usuarios activos estimados** | Clientes identificados distintos + una identidad por cada sesión anónima. | `mart_actividad_web`, recuento distinto de `usuario_analitico_id`. |
| **Ticket promedio** | Venta total / cantidad de pedidos válidos. | `mart_ventas`, promedio del importe por pedido. |
| **NPS** | `(promotores − detractores) × 100 / respuestas`. | `mart_nps`, promedio de `aporte_nps` (`100`, `0`, `−100`). |
| **Ventas por provincia** | Importe de pedidos válidos agrupado por provincia. | `mart_ventas`. |
| **Ranking mensual de productos** | `SUM(line_total)` por producto y mes, ordenado con `RANK()` descendente. | `mart_ranking_productos` y, para filtros adicionales, `mart_detalle_productos`. |

**Valores de referencia sin filtros** (ejecución completa de las consultas SQL):

| Comprobación | Resultado esperado |
|---|---:|
| Pedidos válidos | **10.998** |
| Ventas con IVA | **ARS 382.410.636** |
| Ventas sin IVA | **ARS 317.333.400** |
| Ticket promedio con IVA | **ARS 34.770,93** |
| Usuarios activos estimados | **73.828** |
| NPS general | **+30,0032** |
| Respuestas NPS | **3.083** |
| Sesiones web | **100.363** |

Estos resultados se usan como pruebas de reconciliación entre el DW, las Mart y el dashboard. La presentación puede redondear o abreviar importes, pero las definiciones deben coincidir.

### Alcance y semántica de los filtros

La web ofrece **fecha inicial y final, canal, provincia, producto, selector de IVA y mes del ranking**, pero no todas las fuentes contienen las mismas dimensiones:

- **Ventas:** fecha, canal y provincia. Con un producto elegido, se conservan los **pedidos que incluyen ese producto** (facturación completa por pedido, sin duplicarlo).
- **NPS:** solo fecha y canal; no se atribuye una encuesta a una provincia o producto sin relación sustentada.
- **Actividad web:** el dashboard permite filtrarla por fecha; no infiere canal, provincia o producto para las sesiones.
- **Ranking de productos:** usa importes de **líneas de pedido** y permite recalcular la clasificación visible por mes y filtros compatibles. No confundir esa facturación con el total de los pedidos que contienen el producto.

**Alcance de los cálculos:** `03_consultas.sql` calcula los KPIs generales en SQL y las Mart preparan registros, clasificaciones y el ranking mensual base. En la implementación actual, `app.js` realiza ciertas agregaciones de visualización (sumas, promedios y recuentos distintos) para responder dinámicamente a los filtros. No se afirma que todas las combinaciones posibles de filtros estén precalculadas en SQL.

## 5. Cómo ejecutar y reproducir el proyecto

> **Para ver el dashboard publicado, no hace falta ejecutar nada.** Ir directamente a [GitHub Pages](https://lucagiu204.github.io/practica-imond/). Los siguientes pasos son para reconstruir o auditar los datos.

### Requisitos de desarrollo

- Python 3.9 o superior, Git y terminal.
- Dependencias en `requirements.txt` (DuckDB).
- Navegador web para el dashboard.

### Clonar e instalar (PowerShell)

```powershell
git clone https://github.com/LucaGiu204/practica-imond.git
cd practica-imond
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

En CMD: `.venv\Scripts\activate.bat`. En Linux/macOS: `source .venv/bin/activate`, utilizando `python3` si corresponde.

### Comandos

| Comando | Qué hace |
|---|---|
| `python run_sql.py --explorar` | Abre las vistas del origen para explorar los 13 CSV, sin reconstruir el DW. |
| `python run_sql.py` | Reconstruye el DW, ejecuta los **cinco** SQL, exporta las tablas a `dw/`, actualiza el diagrama y copia las cinco Mart a `docs/data/`. |
| `python run_sql.py --ui` | Reconstruye el DW y abre DuckDB UI o una consola de exploración si la interfaz no está disponible. |
| `deactivate` | Desactiva el entorno virtual. |

**Importante:** ejecutar `run_sql.py` vuelve a crear `warehouse.duckdb` y reemplaza los CSV generados en `dw/` y `docs/data/` con la salida actual. **No modifica los CSV originales de `raw/`.** Cerrar cualquier conexión abierta a DuckDB antes de reconstruir.

`run_sql.py` utiliza una única secuencia: `01_dimensiones.sql` → `02_hechos.sql` → `03_consultas.sql` → `04_marts.sql` → `05_mart_detalle_productos.sql`. Las consultas `SELECT` del tercer archivo se imprimen en la terminal.

### Comprobaciones rápidas en DuckDB

Con `python run_sql.py --ui`, ejecutar:

```sql
-- Pedidos que cuentan como venta
SELECT COUNT(*) AS pedidos_validos FROM mart_ventas;

-- Reconciliación de ventas y ticket promedio
SELECT SUM(ventas_con_iva) AS ventas_con_iva,
       SUM(ventas_sin_iva) AS ventas_sin_iva,
       AVG(ventas_con_iva) AS ticket_promedio_con_iva
FROM mart_ventas;

-- Usuarios activos estimados
SELECT COUNT(DISTINCT usuario_analitico_id) AS usuarios_activos
FROM mart_actividad_web;

-- NPS general
SELECT COUNT(*) AS respuestas, AVG(aporte_nps) AS nps
FROM mart_nps;

-- Ventas por provincia (deben reconciliar con la suma total)
SELECT provincia, SUM(ventas_con_iva) AS ventas
FROM mart_ventas
GROUP BY provincia
ORDER BY ventas DESC;

-- Ranking mensual preparado en SQL
SELECT mes, producto, ventas_producto, ranking
FROM mart_ranking_productos
WHERE mes = '2024-01'
ORDER BY ranking;

-- Control de granularidad del detalle: una fila por ítem
SELECT COUNT(*) AS lineas, COUNT(DISTINCT order_item_id) AS items_distintos
FROM mart_detalle_productos;
```

Como controles adicionales, `mart_ranking_productos` debería contener **42 filas** (21 meses × 2 productos) y `mart_actividad_web`, **100.363 sesiones**.

### Probar la página localmente

Los navegadores pueden bloquear `fetch()` al abrir un HTML mediante `file://`. Desde la raíz del repositorio, iniciar un servidor estático:

```powershell
python -m http.server 8000
```

Abrir **http://localhost:8000/docs/**. Esto es opcional para desarrollar o auditar: **no lo necesita el visitante de GitHub Pages**.

## 6. Dashboard web con GitHub Pages

### Acceso público

**[EcoBottle AR — Dashboard de inteligencia comercial](https://lucagiu204.github.io/practica-imond/)**

Se publica desde **`main` → `/docs`** en la configuración de GitHub Pages. Incluye:

- Tarjetas de facturación, usuarios activos estimados, ticket promedio y NPS.
- Evolución mensual de ventas y usuarios.
- Ventas por provincia.
- Tendencia del NPS y composición de las encuestas.
- Ranking mensual de productos.
- Filtros de fecha, canal, provincia y producto, con los alcances aclarados en la sección 4; selector con/sin IVA.

### Fuentes del navegador

`docs/app.js` únicamente descarga estos archivos, todos copiados desde las Mart del DW:

```text
docs/data/mart_ventas.csv
docs/data/mart_nps.csv
docs/data/mart_actividad_web.csv
docs/data/mart_detalle_productos.csv
docs/data/mart_ranking_productos.csv
```

**No se usan JSON** ni se consulta `raw/` desde la web. GitHub Pages sirve los archivos estáticos; la lectura, filtros y gráficos se ejecutan en el navegador.

**Actualización de datos:** luego de modificar el modelo o los CSV de origen, ejecutar `python run_sql.py`, revisar los indicadores y publicar los archivos modificados en Git mediante `git add`, `git commit` y `git push`. GitHub Pages despliega la nueva versión; el visitante nunca debe ejecutar un script.

## 7. Git, reproducibilidad y entrega

Los cambios se registran con **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) según su intención. Para registrar una actualización de documentación:

```powershell
git status
git add README.md
git commit -m "docs: actualizar README para GitHub Pages y Data Marts CSV"
git push
```

El repositorio contiene **código SQL y Python, HTML/CSS/JavaScript, los 13 CSV de origen, los CSV de dimensiones/hechos/Mart, las copias de Mart para la página y los diagramas**. No requiere publicar `warehouse.duckdb` porque es regenerable.

La URL de GitHub Pages debe presentarse junto al repositorio para que el docente pueda revisar la visualización directamente. Los SQL, el modelo estrella y los archivos de `dw/` permiten auditar el proceso y verificar las métricas por separado.

## 8. Créditos y materiales de referencia

- **Datos simulados y código base:** [Augusto Carmona — practica-imond](https://github.com/AugustoCarmona/practica-imond).
- **Generación de datos de origen:** [`generator/README.md`](./generator/README.md); no es necesario ejecutar el generador para reproducir los resultados ya entregados.
- **Modelo dimensional generado:** [`dw/modelo_estrella.md`](./dw/modelo_estrella.md).
- **Documentación de DuckDB:** https://duckdb.org/docs/
