-- =====================================================
-- 04_marts.sql - Data Marts para Power BI
-- =====================================================
-- Materializacion de indicadores calculados desde el DW.
-- Los Data Marts consumen las dimensiones y hechos,
-- sin consultar directamente los archivos RAW.


-- MART 1: Ventas
-- Acá se consiguen las ventas totales por provincia y canal, con y sin IVA, para cada pedido.

CREATE TABLE mart_ventas AS
SELECT
    o.order_id,
    CAST(o.order_date AS DATE) AS fecha,
    d.year_month AS mes,
    c.name AS canal,
    COALESCE(p.name, 'Sin provincia') AS provincia,
    o.total_amount AS ventas_con_iva,
    o.total_amount - o.tax_amount AS ventas_sin_iva
FROM fact_sales_order AS o
INNER JOIN dim_date AS d
    ON o.date_key = d.date_key
INNER JOIN dim_channel AS c
    ON o.channel_key = c.channel_key
LEFT JOIN dim_province AS p
    ON o.province_key = p.province_key
WHERE o.status IN ('PAID', 'FULFILLED');


-- MART 2: NPS

CREATE TABLE mart_nps AS
SELECT
    n.nps_id,
    d.full_date AS fecha,
    d.year_month AS mes,
    c.name AS canal,
    n.score,
    CASE
        WHEN n.score >= 9 THEN 'Promotores'
        WHEN n.score >= 7 THEN 'Pasivos'
        ELSE 'Detractores'
    END AS categoria_nps,
    CASE
        WHEN n.score >= 9 THEN 100
        WHEN n.score >= 7 THEN 0
        ELSE -100
    END AS aporte_nps

FROM fact_nps_response AS n
INNER JOIN dim_date AS d
    ON n.date_key = d.date_key
INNER JOIN dim_channel AS c
    ON n.channel_key = c.channel_key;


-- MART 3: Ranking mensual de productos

CREATE TABLE mart_ranking_productos AS
SELECT
    d.year_month AS mes,
    p.name AS producto,
    SUM(i.quantity) AS unidades_vendidas,
    SUM(i.line_total) AS ventas_producto,
    RANK() OVER (
        PARTITION BY d.year_month
        ORDER BY SUM(i.line_total) DESC
    ) AS ranking
FROM fact_sales_order_item AS i
INNER JOIN dim_date AS d
    ON i.date_key = d.date_key
INNER JOIN dim_product AS p
    ON i.product_key = p.product_key
WHERE i.status IN ('PAID', 'FULFILLED')
GROUP BY d.year_month, p.name
ORDER BY mes, ranking;


-- MART 4: Actividad web

CREATE TABLE mart_actividad_web AS
SELECT
    d.full_date AS fecha,
    d.year_month AS mes,
    s.session_id,
    s.customer_key,
    s.source,
    s.device,
    CASE
    WHEN s.customer_key IS NOT NULL
        THEN concat('C_', CAST(s.customer_key AS VARCHAR))
    ELSE
        concat('A_', CAST(s.session_id AS VARCHAR))
    END AS usuario_analitico_id
FROM fact_web_session AS s
INNER JOIN dim_date AS d
    ON s.date_key = d.date_key;