# EcoBottle AR — Data Warehouse y análisis comercial

**Trabajo práctico | Introducción al Marketing Online y los Negocios Digitales**

Implementación de un ecosistema de datos comerciales para **EcoBottle AR**, que vende las botellas reutilizables *Classic A Bottle* y *Sport B Bottle* mediante canal online y cuatro tiendas físicas. El proyecto transforma los CSV originales en un **Data Warehouse dimensional (enfoque Kimball)**, construye indicadores con SQL y genera **Data Marts** para su visualización en Power BI.

- [Consigna del trabajo práctico](https://docs.google.com/document/d/15RNP3FVqLjO4jzh80AAkK6mUR5DOLqPxLjQxqvdzrYg/edit?usp=sharing)
- [Repositorio base del profesor](https://github.com/AugustoCarmona/practica-imond)
- [Diagrama del modelo dimensional generado](./dw/modelo_estrella.md)
- [Diagrama entidad–relación de los datos RAW](./assets/DER.png)

> **Estado del proyecto:** las dimensiones, los hechos, las consultas de los seis KPIs y las cuatro Data Marts están implementados. El dashboard de Power BI y sus capturas se incorporarán al repositorio cuando estén terminados.

## 1. Arquitectura

La solución separa **datos de origen**, **almacén dimensional**, **capa analítica** y **visualización**.

```text
13 CSV originales (raw/)
        |
        v
run_sql.py + DuckDB
        |
        +--> 01_dimensiones.sql  --> 6 dimensiones
        |
        +--> 02_hechos.sql       --> 6 tablas de hechos
        |
        +--> 03_consultas.sql    --> cálculos y verificaciones de KPIs
        |
        +--> 04_marts.sql        --> 4 Data Marts materializadas
        |
        v
warehouse.duckdb + dw/*.csv (archivos locales regenerables)
        |
        v
Power BI (dashboard comercial)
```

**Decisiones arquitectónicas:**

- **RAW:** los 13 archivos `raw/*.csv` son la fuente original y no se modifican. El programa los registra como vistas `raw.nombre_tabla` en DuckDB.
- **Dimensiones:** atributos descriptivos (fecha, cliente, producto, canal, provincia y tienda); se emplean claves subrogadas en el DW, excepto la fecha, cuya clave es `YYYYMMDD`.
- **Hechos:** eventos de negocio con una granularidad explícita y claves foráneas a las dimensiones. Se conservaron todos los estados de los pedidos; los indicadores comerciales aplican su filtro por separado.
- **Consultas:** `03_consultas.sql` conserva las expresiones de los KPIs para verificarlas desde la terminal.
- **Data Marts:** `04_marts.sql` crea tablas físicas orientadas al consumo de Power BI. Las Mart se construyen a partir de dimensiones y hechos, no directamente de RAW.
- **Orquestación:** `run_sql.py` ejecuta los archivos SQL por nombre en orden alfabético, reconstruye la base, exporta las tablas a CSV y genera un diagrama Mermaid desde las relaciones PK/FK.

### Estructura del repositorio

```text
practica-imond/
├── raw/                       # 13 CSV originales (versionados)
├── sql/
│   ├── 01_dimensiones.sql     # Dimensiones
│   ├── 02_hechos.sql          # Hechos
│   ├── 03_consultas.sql       # Seis KPIs y comprobaciones
│   └── 04_marts.sql           # Cuatro tablas para Power BI
├── dw/
│   └── modelo_estrella.md     # Diagrama generado y versionado
├── assets/                    # DER de origen
├── generator/                 # Generador de datos de ejemplo del repositorio base
├── run_sql.py                 # Ejecuta y exporta el DW
├── requirements.txt          # Dependencias Python
├── .gitignore
└── README.md
```

**Importante:** `warehouse.duckdb` y los CSV de `dw/` **no están versionados**: se generan localmente con `python run_sql.py`. En cambio, los 13 CSV de `raw/` sí se conservan en Git. El diagrama `dw/modelo_estrella.md` se mantiene en el repositorio.

## 2. Datos y alcance

- **Empresa:** EcoBottle AR; dos productos, canales `ONLINE` y `OFFLINE`, cuatro provincias (Buenos Aires, Córdoba, Santa Fe y Mendoza).
- **Período:** del 01/01/2024 al 30/09/2025; fotografía de origen al 30/09/2025 a las 23:59:59.
- **Moneda:** pesos argentinos (`ARS`); precios de lista sin IVA.
- **Regla de importes:** `line_total = quantity × unit_price − discount_amount`; `subtotal = SUM(line_total)`; `tax_amount = 21 % de subtotal`; `total_amount = subtotal + tax_amount + shipping_fee`.
- **Fuentes originales:** `address`, `channel`, `customer`, `nps_response`, `payment`, `product`, `product_category`, `province`, `sales_order`, `sales_order_item`, `shipment`, `store` y `web_session`.
- **Nulos:** una celda vacía de CSV se interpreta como `NULL`.

![DER de los datos de origen](./assets/DER.png)

El modelo estrella implementado (con tipos, claves y relaciones reales) se puede consultar en **[`dw/modelo_estrella.md`](./dw/modelo_estrella.md)**.

## 3. Diccionario de datos

Las claves marcadas como **PK** y **FK** describen las restricciones declaradas en los scripts SQL. Los campos `order_id` que aparecen como referencias operativas en otras tablas de hechos **no están declarados como FK** a `fact_sales_order`; se usan para identificar y vincular pedidos.

### 3.1 Dimensiones

| Tabla | Clave primaria y claves de origen | Otros campos (tipo y significado) |
|---|---|---|
| `dim_product` | `product_key INTEGER` **PK**, `product_id INTEGER` | `sku VARCHAR`, `name VARCHAR`, `category VARCHAR`, `family VARCHAR` (jerarquía aplanada), `list_price DECIMAL(12,2)`. |
| `dim_channel` | `channel_key INTEGER` **PK**, `channel_id INTEGER UNIQUE` | `code VARCHAR(20)`, `name VARCHAR(50)`. |
| `dim_customer` | `customer_key INTEGER` **PK**, `customer_id INTEGER UNIQUE` | `email VARCHAR(120)`, `first_name VARCHAR(80)`, `last_name VARCHAR(80)`, `phone VARCHAR(30)`, `status CHAR(1)`, `created_at TIMESTAMP`. |
| `dim_date` | `date_key INTEGER` **PK** (`YYYYMMDD`), `full_date DATE UNIQUE` | `year SMALLINT`, `month TINYINT`, `day TINYINT`, `quarter TINYINT`, `year_month VARCHAR(7)` (`YYYY-MM`). |
| `dim_province` | `province_key INTEGER` **PK**, `province_id INTEGER UNIQUE` | `name VARCHAR(50)`, `code VARCHAR(10)`. |
| `dim_store` | `store_key INTEGER` **PK**, `store_id INTEGER UNIQUE` | `name VARCHAR(80)`, `address_id INTEGER` (referencia al origen; no es FK declarada a una dimensión de dirección). |

**Origen:** las dimensiones se cargan desde `raw`; `dim_product` integra `product` y la jerarquía `product_category`. La dimensión fecha se genera para todos los días del período.

### 3.2 Tablas de hechos

| Tabla y granularidad (una fila por…) | PK | FK declaradas a dimensiones | Campos operativos, métricas y tipos |
|---|---|---|---|
| `fact_sales_order` — pedido | `order_id BIGINT` | `date_key`, `customer_key`, `channel_key`, `province_key`, `store_key` (`INTEGER`) | `order_date TIMESTAMP`, `status VARCHAR(20)`, `currency_code CHAR(3)`, `subtotal`, `tax_amount`, `shipping_fee`, `discount_total` y `total_amount` (todos `DECIMAL(12,2)`). |
| `fact_sales_order_item` — línea de pedido | `order_item_id BIGINT` | `product_key`, `date_key`, `customer_key`, `channel_key`, `province_key`, `store_key` | `order_id BIGINT`, `order_date TIMESTAMP`, `status VARCHAR(20)`, `quantity INTEGER`, `unit_price`, `discount_amount`, `line_total` (`DECIMAL(12,2)`). |
| `fact_payment` — pago | `payment_id BIGINT` | `payment_date_key`, `customer_key`, `channel_key`, `province_key`, `store_key` | `order_id BIGINT`, `method VARCHAR(20)`, `status VARCHAR(20)`, `amount DECIMAL(12,2)`, `paid_at TIMESTAMP`, `transaction_ref VARCHAR(80)`. |
| `fact_shipment` — envío | `shipment_id BIGINT` | `shipped_date_key`, `delivered_date_key`, `customer_key`, `channel_key`, `province_key`, `store_key` | `order_id BIGINT`, `carrier VARCHAR(40)`, `tracking_number VARCHAR(60)`, `status VARCHAR(20)`, `shipped_at TIMESTAMP`, `delivered_at TIMESTAMP`. Las dos fechas referencian `dim_date`. |
| `fact_web_session` — sesión | `session_id BIGINT` | `date_key`, `customer_key` | `started_at TIMESTAMP`, `ended_at TIMESTAMP`, `source VARCHAR(50)`, `device VARCHAR(30)`. `customer_key` puede ser `NULL`. |
| `fact_nps_response` — respuesta NPS | `nps_id BIGINT` | `date_key`, `customer_key`, `channel_key` | `score SMALLINT` (restricción `CHECK 0..10`), `comment VARCHAR(500)`. `customer_key` puede ser `NULL`. |

Las claves foráneas son de tipo `INTEGER`; algunos campos son opcionales según el evento (por ejemplo, `store_key` en compras online, provincia no informada, fechas de pago/entrega pendientes, sesiones y encuestas anónimas).

### 3.3 Data Marts

| Tabla | Granularidad | Columnas generadas / dominio | Uso previsto |
|---|---|---|---|
| `mart_ventas` | Un **pedido válido** | `order_id BIGINT`, `fecha DATE`, `mes VARCHAR`, `canal VARCHAR`, `provincia VARCHAR`, `ventas_con_iva DECIMAL`, `ventas_sin_iva DECIMAL` | Ventas, ticket promedio, series temporales y desglose por provincia/canal. |
| `mart_nps` | Una **respuesta** | `nps_id BIGINT`, `fecha DATE`, `mes VARCHAR`, `canal VARCHAR`, `score SMALLINT`, `categoria_nps VARCHAR`, `aporte_nps INTEGER` (100, 0 o -100) | NPS y proporción de promotores, pasivos y detractores. |
| `mart_ranking_productos` | Un **producto en un mes** | `mes VARCHAR`, `producto VARCHAR`, `unidades_vendidas HUGEINT`, `ventas_producto DECIMAL`, `ranking BIGINT` | Ranking mensual calculado en SQL, por facturación neta de descuentos de `line_total`. |
| `mart_actividad_web` | Una **sesión** | `fecha DATE`, `mes VARCHAR`, `session_id BIGINT`, `customer_key INTEGER`, `source VARCHAR`, `device VARCHAR`, `usuario_analitico_id VARCHAR` | Sesiones y usuarios activos estimados mediante recuento distinto. |

### 3.4 Dominios y supuestos del modelo

| Campo / criterio | Valores o regla |
|---|---|
| `sales_order.status` | `CREATED`, `PAID`, `FULFILLED`, `CANCELLED`, `REFUNDED`. Solo **PAID** y **FULFILLED** cuentan como venta. |
| `customer.status` | `A` (activo), `I` (inactivo). Se conservan las ventas históricas aunque el cliente esté inactivo actualmente. |
| `channel.code` | `ONLINE` y `OFFLINE`. |
| `payment.method` | `CASH`, `CARD`, `TRANSFER`, `GATEWAY`. |
| `payment.status` | `PENDING`, `PAID`, `FAILED`, `REFUNDED`. |
| `shipment.status` | `READY`, `SHIPPED`, `DELIVERED`, `CANCELLED`. |
| `nps_response.score` | Entero de 0 a 10. Detractores: 0–6; pasivos: 7–8; promotores: 9–10. |
| Provincia de la venta | Se obtiene desde la dirección de envío del pedido, enlazando con `raw.address` y `dim_province` durante la carga de hechos. Un valor faltante se muestra como **Sin provincia** en la Mart. |
| Fecha de pago / envío / entrega | Puede ser `NULL` si el evento todavía no sucedió; en envíos se reutiliza `dim_date` para salida y entrega (dimensión de rol). |
| Claves subrogadas | `ROW_NUMBER()` ordenado por ID original para dimensiones, salvo `dim_date` que usa `YYYYMMDD`. |
| Descuentos e impuestos | `line_total` y `subtotal` ya incorporan descuentos. `ventas_sin_iva = total_amount - tax_amount`; **incluye envío** igual que la versión con IVA. No se divide todo el total por 1,21 porque el envío se suma por separado. |
| Usuarios anónimos | Se cuenta cada sesión anónima como una unidad estimada; **no equivale necesariamente a personas únicas**. |
| Ranking | Se calcula para cada mes con `RANK() OVER (PARTITION BY mes …)`. Los empates comparten puesto. |

## 4. KPIs y definiciones de negocio

| KPI | Definición SQL | Tabla para la visualización |
|---|---|---|
| **Ventas totales** | Suma de `total_amount` en pedidos `PAID/FULFILLED`. Sin IVA: suma de `total_amount - tax_amount`. | `mart_ventas` — **Suma** de importes. |
| **Usuarios activos (estimados)** | Clientes identificados distintos **más cada sesión anónima** dentro del período seleccionado. | `mart_actividad_web` — **Recuento distinto** de `usuario_analitico_id`. |
| **Ticket promedio** | Ventas de pedidos válidos ÷ cantidad de pedidos válidos. | `mart_ventas` — **Promedio** de importe por pedido. |
| **NPS** | `(promotores − detractores) × 100 / total de respuestas`. | `mart_nps` — **Promedio** de `aporte_nps` (+100, 0, −100). |
| **Ventas por provincia** | Ventas válidas agrupadas por provincia asociada a dirección de envío. | `mart_ventas` — agrupar por `provincia` y sumar importes. |
| **Ranking mensual por producto** | Suma de `line_total` por mes/producto; posición con `RANK()` descendente. | `mart_ranking_productos` — `ranking` ya calculado. |

**Resultados de referencia de la ejecución completa** (sin filtros): ventas con IVA **ARS 382.410.636**, ventas sin IVA **ARS 317.333.400**, ticket promedio con IVA **ARS 34.770,93**, usuarios activos estimados **73.828** y NPS **30,0032** sobre **3.083** respuestas. Estos valores sirven para controlar que la carga y los cálculos sean reproducibles.

**Importante para los filtros:** las cuatro Mart no poseen idénticas dimensiones. `mart_ventas` permite fecha, mes, canal y provincia; `mart_nps` permite fecha, mes y canal; `mart_ranking_productos` permite mes y producto; `mart_actividad_web` permite fecha, mes, fuente y dispositivo. **No corresponde aplicar provincia/producto al NPS o producto a sesiones web sin una relación sustentada por los datos.** La Mart de ventas actual no posee `product_key`, por lo que **el filtro por producto no modifica la facturación global**. El ranking está precalculado por mes y **no se recalcula por provincia/canal**. Estas limitaciones deben revisarse al completar los filtros del dashboard.

## 5. Ejecución desde cero

### Requisitos

- Python **3.9 o superior**, Git y acceso a una terminal.
- Dependencias definidas en `requirements.txt` (DuckDB).
- Power BI Desktop para el tablero, cuando se incorpore.

### Clonar e instalar

Desde una terminal en Windows / VS Code:

```powershell
git clone https://github.com/LucaGiu204/practica-imond.git
cd practica-imond
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Si VS Code usa **CMD** en vez de PowerShell, activar con `.venv\Scripts\activate.bat`. En Linux/macOS, con `source .venv/bin/activate` (y `python3` donde corresponda).

### Comandos del proyecto

| Comando | Acción |
|---|---|
| `python run_sql.py --explorar` | Examina solo los 13 archivos originales desde las vistas `raw`, **sin reconstruir el DW**. |
| `python run_sql.py` | Reconstruye `warehouse.duckdb`, ejecuta los cuatro SQL y exporta dimensiones, hechos y Mart a `dw/*.csv`. |
| `python run_sql.py --ui` | Reconstruye el DW y abre la interfaz de DuckDB en el navegador; si no está disponible, permite consultar desde consola. |
| `deactivate` | Sale del entorno virtual. |

**Atención:** ejecutar `python run_sql.py` o `--ui` **elimina y vuelve a crear** `warehouse.duckdb` y los CSV generados en `dw/`. No modifica `raw/`. Conviene cerrar primero cualquier interfaz o conexión que esté usando la base.

El script lee, en este orden, `01_dimensiones.sql`, `02_hechos.sql`, `03_consultas.sql` y `04_marts.sql`. Muestra los `SELECT` del tercer archivo, crea las Mart del cuarto y exporta todas las tablas resultantes.

### Pruebas rápidas desde DuckDB

Iniciá `python run_sql.py --ui` y ejecutá:

```sql
-- Cantidad de pedidos de ventas válidas
SELECT COUNT(*) AS pedidos_validos FROM mart_ventas;

-- Reconciliación de ventas y ticket (una fila por pedido)
SELECT SUM(ventas_con_iva) AS ventas_con_iva,
       SUM(ventas_sin_iva) AS ventas_sin_iva,
       AVG(ventas_con_iva) AS ticket_promedio_con_iva
FROM mart_ventas;

-- Usuarios activos estimados, sin duplicar clientes con varias sesiones
SELECT COUNT(DISTINCT usuario_analitico_id) AS usuarios_activos
FROM mart_actividad_web;

-- NPS general
SELECT COUNT(*) AS respuestas, AVG(aporte_nps) AS nps
FROM mart_nps;

-- Ventas por provincia
SELECT provincia, SUM(ventas_con_iva) AS ventas
FROM mart_ventas
GROUP BY provincia
ORDER BY ventas DESC;

-- Ranking mensual preparado para el tablero
SELECT mes, producto, ventas_producto, ranking
FROM mart_ranking_productos
WHERE mes = '2024-01'
ORDER BY ranking;
```

**Verificaciones esperadas:** `mart_ventas` contiene **10.998 pedidos válidos**; la suma de las ventas por provincia debe coincidir con ventas totales; `mart_nps` contiene **3.083 respuestas**; `mart_actividad_web` contiene **100.363 sesiones**; `mart_ranking_productos` contiene **42 filas** (21 meses × 2 productos).

## 6. Dashboard en Power BI

**Estado: pendiente de incorporación.** La consigna incluye entre sus vistas mínimas: ventas (evolución y tarjeta), usuarios activos (serie y tarjeta), ticket promedio, NPS (tarjeta y tendencia), ventas por provincia y ranking mensual por producto. También solicita segmentadores de fecha, canal, provincia y producto.

Se utilizarán como fuentes los siguientes archivos locales, generados previamente:

- `dw/mart_ventas.csv`
- `dw/mart_actividad_web.csv`
- `dw/mart_nps.csv`
- `dw/mart_ranking_productos.csv`

La lógica de negocio se prepara en DuckDB/SQL; en Power BI se prevé utilizar agregaciones automáticas (suma, promedio y recuento distinto) y visualizaciones, evitando medidas DAX para estos indicadores. No se deben establecer relaciones o filtros entre datos sin correspondencia real.

**Publicación pendiente:** el archivo `.pbix` y capturas del dashboard se incorporarán a este repositorio al finalizar la visualización. Al clonar en otra PC, primero se deben regenerar los CSV con `python run_sql.py` y luego verificar/cambiar las rutas de origen del archivo de Power BI.

> **Nota sobre la consigna:** el documento enlazado indica Power BI en la sección de tareas y Looker Studio en una línea de entregables. En este proyecto se implementará **Power BI**, siguiendo la indicación de trabajo acordada en clase.

## 7. Git, reproducibilidad y entrega

La gestión del repositorio se realiza desde la **consola**, con **conventional commits** para identificar la intención de los cambios. Ejemplos:

```powershell
git status
git add README.md
git commit -m "docs: documentar arquitectura y KPIs"
git push
```

Otros prefijos habituales son `feat:` para nuevas funcionalidades y `fix:` para correcciones. Antes de cada entrega conviene ejecutar `git status` y `python run_sql.py`, revisar los importes y comprobar que el dashboard use los datos actualizados.

Los **CSV de `dw/` no se suben a Git**, porque son resultados regenerables. Se entregan el código, los CSV de origen, la documentación, el modelo y, una vez terminado, el dashboard de Power BI.

## 8. Créditos y materiales de referencia

- **Datos simulados y código base de ejecución:** [Augusto Carmona — practica-imond](https://github.com/AugustoCarmona/practica-imond).
- **Generador de origen:** [`generator/README.md`](./generator/README.md). No es necesario ejecutar el generador para reproducir los resultados incluidos.
- **Consulta del modelo implementado:** [`dw/modelo_estrella.md`](./dw/modelo_estrella.md).
- **Documentación de DuckDB:** https://duckdb.org/docs/
