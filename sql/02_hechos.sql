-- =====================================================================
-- 02_hechos.sql — Tablas de HECHOS del modelo estrella
-- =====================================================================
-- Este archivo se ejecuta después de 01_dimensiones.sql porque los hechos
-- apuntan a las dimensiones con FOREIGN KEY (REFERENCES).
--
-- Para cada tabla de hechos:
--   1. Definí el GRANO: ¿qué representa UNA fila?
--      (ej.: un producto dentro de un pedido, una sesión web, una respuesta NPS)
--   2. CREATE TABLE con:
--        - PRIMARY KEY
--        - una FOREIGN KEY por cada dimensión:  product_key INTEGER REFERENCES dim_product (product_key)
--        - las métricas (cantidades, importes, puntajes...)
--   3. INSERT INTO ... SELECT uniendo las tablas de origen (raw.) con las dimensiones
--      para obtener las claves.
--
-- Patrón para obtener la clave de una dimensión:
--
--   SELECT i.order_item_id, p.product_key, i.quantity, i.line_total
--   FROM raw.sales_order_item AS i
--   JOIN dim_product AS p ON p.product_id = i.product_id
--
-- Si una FOREIGN KEY apunta a una clave que no existe en la dimensión,
-- DuckDB rechaza la carga y run_sql.py te muestra el error.
-- =====================================================================


-- TU TURNO: creá acá las tablas de hechos.

-- ==========================================
-- HECHOS: VENTAS
-- ==========================================

CREATE TABLE fact_sales (
    order_item_id BIGINT PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER,
    customer_id INTEGER,
    store_id INTEGER,
    channel_id INTEGER,
    province_id INTEGER,
    order_date TIMESTAMP,
    sale_date DATE,
    quantity INTEGER,
    unit_price DECIMAL(12,2),
    discount_amount DECIMAL(12,2),
    line_total DECIMAL(12,2)
);

INSERT INTO fact_sales
SELECT 
    i.order_item_id,
    i.order_id,
    i.product_id,
    o.customer_id,
    o.store_id,
    o.channel_id,
    a.province_id, 
    o.order_date,
    CAST(o.order_date AS DATE),
    i.quantity,
    i.unit_price,
    i.discount_amount,
    i.line_total
FROM raw.sales_order_item i
JOIN raw.sales_order o ON i.order_id = o.order_id
LEFT JOIN raw.address a ON o.shipping_address_id = a.address_id
WHERE o.status IN ('PAID', 'FULFILLED');

-- ==========================================
-- HECHOS: SESIONES WEB (Usuarios Activos)
-- ==========================================

CREATE TABLE fact_web_session (
    session_id BIGINT PRIMARY KEY,
    customer_id INTEGER,
    started_at TIMESTAMP,
    session_date DATE,
    ended_at TIMESTAMP,
    source VARCHAR,
    device VARCHAR
);

INSERT INTO fact_web_session
SELECT 
    session_id,
    customer_id,
    started_at,
    CAST(started_at AS DATE),
    ended_at,
    source,
    device
FROM raw.web_session;

-- ==========================================
-- HECHOS: RESPUESTAS NPS
-- ==========================================

CREATE TABLE fact_nps_response (
    nps_id BIGINT PRIMARY KEY,
    customer_id INTEGER,
    channel_id INTEGER,
    score INTEGER,
    comment VARCHAR,
    responded_at TIMESTAMP,
    response_date DATE
);

INSERT INTO fact_nps_response
SELECT 
    nps_id,
    customer_id,
    channel_id,
    score,
    comment,
    responded_at,
    CAST(responded_at AS DATE)
FROM raw.nps_response;