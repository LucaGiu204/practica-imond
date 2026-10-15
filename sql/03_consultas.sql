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
    SUM(total_amount) - SUM(tax_amount) AS ventas_sin_iva,
    SUM(total_amount) - SUM(tax_amount) - SUM(shipping_fee) AS ventas_sin_iva_ni_envio
FROM fact_sales_order
WHERE status IN ('PAID', 'FULFILLED');

-- KPI 2 ticket promedio

SELECT
    SUM(total_amount) / COUNT(*) AS ticket_promedio_con_iva,
    SUM(total_amount - tax_amount) / COUNT(*) AS ticket_promedio_sin_iva,
    SUM(total_amount - tax_amount - shipping_fee) / COUNT(*) AS ticket_promedio_sin_iva_ni_envio
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
    COUNT(*) AS cantidad
FROM fact_nps_response
GROUP BY categoria_nps;

