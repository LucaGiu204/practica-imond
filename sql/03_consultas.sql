-- =====================================================================
-- 03_consultas.sql — Consultas para revisar el modelo y calcular KPIs
-- =====================================================================
-- Cada SELECT de este archivo se muestra en la terminal al ejecutar
-- run_sql.py. Usalo para:
--   * comprobar que las tablas se cargaron bien (cantidad de filas, nulos...)
--   * escribir las consultas clave de los KPIs que pide la consigna
--     (ventas, usuarios activos, ticket promedio, NPS, ventas por provincia,
--     ranking mensual por producto) usando las tablas del modelo estrella.
-- =====================================================================


-- Ejemplo: revisar la dimensión producto
SELECT product_key, name, category, family, list_price
FROM dim_product
ORDER BY product_key;


-- TU TURNO: agregá acá tus consultas.

-- KPI 1 y 3: Total Ventas y Ticket Promedio
SELECT 
    SUM(total_amount) AS total_ventas,
    SUM(total_amount) / COUNT(*) AS ticket_promedio
FROM raw.sales_order
WHERE status IN ('PAID', 'FULFILLED');

-- KPI 2: Usuarios Activos (anónimos y registrados)
SELECT 
    COUNT(DISTINCT COALESCE(customer_id, session_id)) AS usuarios_activos
FROM raw.web_session;

-- KPI 4: Net Promoter Score (NPS)
SELECT 
    (SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) - 
    (SUM(CASE WHEN score <= 6 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) AS nps_puntos
FROM raw.nps_response;

-- KPI 5: Ventas Totales por Provincia
SELECT 
    p.name AS provincia,
    SUM(o.total_amount) AS ventas_provincia
FROM raw.sales_order o
JOIN raw.address a ON o.shipping_address_id = a.address_id
JOIN raw.province p ON a.province_id = p.province_id
WHERE o.status IN ('PAID', 'FULFILLED')
GROUP BY p.name
ORDER BY ventas_provincia DESC;

-- KPI 6: Ranking Mensual por Producto
SELECT 
    DATE_TRUNC('month', o.order_date) AS mes,
    p.name AS producto,
    SUM(i.line_total) AS ingresos
FROM raw.sales_order_item i
JOIN raw.sales_order o ON i.order_id = o.order_id
JOIN raw.product p ON i.product_id = p.product_id
WHERE o.status IN ('PAID', 'FULFILLED')
GROUP BY mes, producto
ORDER BY mes, ingresos DESC;