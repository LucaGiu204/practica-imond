```markdown
# Proyecto Data Warehouse: Mini-ecosistema Comercial EcoBottle

Este repositorio contiene la implementación de un Data Warehouse estructurado en un modelo estrella (Kimball) para la empresa EcoBottle AR. El pipeline procesa datos transaccionales crudos (CSV) utilizando **DuckDB** y **Python**, generando un modelo dimensional listo para ser consumido en herramientas de BI (como Looker Studio).

## ⚙️ Instrucciones de Ejecución

Para replicar el entorno y generar el Data Warehouse desde cero, ejecutá los siguientes comandos en tu terminal:

1. **Clonar el repositorio:**
   ```bash
   git clone [URL-DE-TU-REPOSITORIO]
   cd [NOMBRE-DE-LA-CARPETA]

```

2. **Crear y activar el entorno virtual:**
```bash
python -m venv .venv
# En Windows:
.venv\Scripts\activate
# En Mac/Linux:
source .venv/bin/activate

```


3. **Instalar dependencias:**
```bash
pip install -r requirements.txt

```


4. **Ejecutar el pipeline ETL:**
```bash
python run_sql.py

```


*Este comando crea la base warehouse.duckdb, ejecuta las transformaciones SQL, exporta los CSV a la carpeta dw/ y dibuja el modelo de relaciones en dw/modelo_estrella.md.*

## 🧠 Supuestos del Modelo

Durante el diseño de la arquitectura y las transformaciones, se tomaron las siguientes decisiones de negocio:

* **Filtro de Ventas Reales:** Para el cálculo de ingresos y ticket promedio, la tabla de hechos fact_sales y las consultas clave filtran exclusivamente los pedidos con estado PAID o FULFILLED, descartando carritos abandonados o cancelados.
* **Granularidad y Duplicación de Impuestos:** Para evitar inflar los ingresos al cruzar la cabecera del pedido con sus múltiples líneas de detalle, se omitió el campo tax_amount (nivel pedido) en la tabla de hechos a nivel producto, basando el análisis de ingresos estrictamente en la columna line_total.
* **Usuarios Activos:** El conteo de usuarios activos contempla tanto a clientes registrados (customer_id) como a visitantes anónimos (session_id), utilizando la función COALESCE para unificarlos.

## 📚 Diccionario de Datos

El modelo final exportado a la carpeta dw/ se compone de las siguientes tablas:

| Tabla | Tipo | Descripción Principal | PK |
| --- | --- | --- | --- |
| **dim_product** | Dimensión | Catálogo de botellas comercializadas (Classic A, Sport B) y precios de lista. | product_key |
| **dim_customer** | Dimensión | Maestro de clientes con datos de contacto. | customer_key |
| **dim_channel** | Dimensión | Canales de venta (Online, Offline). | channel_id |
| **dim_province** | Dimensión | Provincias de facturación/envío normalizadas. | province_id |
| **dim_store** | Dimensión | Puntos de venta físicos. | store_id |
| **fact_sales** | Hechos | Detalle granular de ventas a nivel producto (line_total). | order_item_id |
| **fact_web_session** | Hechos | Registro de sesiones de navegación para análisis de tráfico. | session_id |
| **fact_nps_response** | Hechos | Respuestas de encuestas de satisfacción. | nps_id |

## 📊 Consultas Clave (KPIs)

El archivo sql/03_consultas.sql contiene las validaciones matemáticas de los 6 KPIs solicitados para el dashboard comercial:

1. **Total Ventas ($M):** Sumatoria de los montos totales de ventas concretadas.
2. **Ticket Promedio ($K):** Promedio de gasto por pedido validado.
3. **Usuarios Activos (nK):** Conteo de visitantes únicos (registrados y anónimos) en la plataforma web.
4. **NPS:** Porcentaje de promotores (9-10) menos porcentaje de detractores (0-6).
5. **Ventas por Provincia:** Agrupación geográfica de los ingresos.
6. **Ranking Mensual por Producto:** Sumatoria de ingresos a nivel ítem agrupada por mes y nombre de producto.
