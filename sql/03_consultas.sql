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

-- KPI 1: Ventas totales

SELECT
    SUM(total_amount) AS ventas_con_iva,
    SUM(total_amount) - SUM(tax_amount) AS ventas_sin_iva
FROM fact_sales_order
WHERE status IN ('PAID', 'FULFILLED');

-- KPI 2 ticket promedio

SELECT
    SUM(total_amount) / COUNT(*) AS ticket_promedio_con_iva,
    SUM(total_amount - tax_amount) / COUNT(*) AS ticket_promedio_sin_iva
FROM fact_sales_order
WHERE status IN ('PAID', 'FULFILLED');


-- KPI 3: Usuarios activos

SELECT
    COUNT(DISTINCT customer_key) + COUNT(*) FILTER (WHERE customer_key IS NULL)
    AS usuarios_activos
FROM fact_web_session;


-- KPI 4: NPS

SELECT
    (
    COUNT(*) FILTER (WHERE score >= 9) - COUNT(*) FILTER (WHERE score <= 6)
    ) * 100.0 / NULLIF(COUNT(*), 0) AS nps
FROM fact_nps_response;

SELECT
    CASE
        WHEN score >= 9 THEN 'Promotores'
        WHEN score >= 7 THEN 'Pasivos'
        ELSE 'Detractores'
    END AS categoria_nps,
    COUNT(*) AS cantidad,
    SUM(COUNT(*)) OVER () AS total,
    COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0) AS porcentaje
FROM fact_nps_response
GROUP BY categoria_nps;

-- KPI 5: Ventas por provincia

SELECT
    COALESCE(p.name, 'Sin provincia') AS provincia,
    SUM(o.total_amount) AS ventas_con_iva,
    SUM(o.total_amount - o.tax_amount) AS ventas_sin_iva
FROM fact_sales_order AS o
LEFT JOIN dim_province AS p
    ON o.province_key = p.province_key
WHERE o.status IN ('PAID', 'FULFILLED')
GROUP BY p.name
ORDER BY ventas_con_iva DESC;