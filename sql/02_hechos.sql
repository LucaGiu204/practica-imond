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

-- =====================================================================
-- Tabla de hechos de pedidos de venta
-- ====================================================================
CREATE TABLE fact_sales_order (
    order_id BIGINT PRIMARY KEY,

    date_key INTEGER NOT NULL REFERENCES dim_date(date_key), -- REFERENCES usado para declarar las claves foráneas que apuntan a las dimensiones
    customer_key INTEGER REFERENCES dim_customer(customer_key),
    channel_key INTEGER NOT NULL REFERENCES dim_channel(channel_key),
    province_key INTEGER REFERENCES dim_province(province_key), -- Puede ser NULL si la compra es presencial y no tiene dirección de envío
    store_key INTEGER REFERENCES dim_store(store_key), -- Puede ser NULL si la compra es online y no tiene tienda asociada

    order_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    currency_code CHAR(3),

    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL,
    shipping_fee DECIMAL(12,2) NOT NULL,
    discount_total DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL
);


INSERT INTO fact_sales_order
SELECT
    o.order_id,
    d.date_key,
    c.customer_key,
    ch.channel_key,
    p.province_key,
    s.store_key,
    o.order_date,
    o.status,
    o.currency_code,
    o.subtotal,
    o.tax_amount,
    o.shipping_fee,
    COALESCE(descuentos.discount_total, 0) AS discount_total,
    o.total_amount
FROM raw.sales_order AS o

INNER JOIN dim_date AS d
    ON d.full_date = CAST(o.order_date AS DATE)

INNER JOIN dim_customer AS c
    ON c.customer_id = o.customer_id

INNER JOIN dim_channel AS ch
    ON ch.channel_id = o.channel_id

LEFT JOIN raw.address AS a -- uso LEFT JOIN para los que pueden ser NULL (compras presenciales sin dirección de envío)
    ON o.shipping_address_id = a.address_id

LEFT JOIN dim_province AS p 
    ON a.province_id = p.province_id

LEFT JOIN dim_store AS s -- uso LEFT JOIN para los que pueden ser NULL (compras online sin tienda asociada)
    ON o.store_id = s.store_id

-- Calculamos el descuento total de cada pedido
LEFT JOIN (
    SELECT
        order_id,
        SUM(discount_amount) AS discount_total
    FROM raw.sales_order_item
    GROUP BY order_id
) AS descuentos
    ON o.order_id = descuentos.order_id;


-- =====================================================================
-- Tabla de hechos de items en pedidos de venta
-- ====================================================================

CREATE TABLE fact_sales_order_item (
    order_item_id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,

    product_key INTEGER NOT NULL REFERENCES dim_product(product_key), -- claves que voy a buscar en la tabla de hechos
    date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
    customer_key INTEGER REFERENCES dim_customer(customer_key),
    channel_key INTEGER NOT NULL REFERENCES dim_channel(channel_key),
    province_key INTEGER REFERENCES dim_province(province_key),
    store_key INTEGER REFERENCES dim_store(store_key),

    order_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,

    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL
);

INSERT INTO fact_sales_order_item
SELECT
    i.order_item_id,
    o.order_id,
    p.product_key,
    o.date_key,
    o.customer_key,
    o.channel_key,
    o.province_key,
    o.store_key,
    o.order_date,
    o.status,
    i.quantity,
    i.unit_price,
    i.discount_amount,
    i.line_total
    
FROM raw.sales_order_item AS i
INNER JOIN fact_sales_order AS o --uso las claves que ya tengo en la tabla de hechos de pedidos para no tener que volver a unir con las dimensiones
    ON i.order_id = o.order_id
INNER JOIN dim_product AS p
    ON i.product_id = p.product_id;


-- =====================================================================
-- Tabla de hechos de pagos
-- ====================================================================


CREATE TABLE fact_payment (
    payment_id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,

    payment_date_key INTEGER REFERENCES dim_date(date_key), -- puede ser NULL si el pago no se realizó (PENDING o FAILED)
    customer_key INTEGER REFERENCES dim_customer(customer_key),
    channel_key INTEGER NOT NULL REFERENCES dim_channel(channel_key),
    province_key INTEGER REFERENCES dim_province(province_key),
    store_key INTEGER REFERENCES dim_store(store_key),

    method VARCHAR(20),
    status VARCHAR(20),
    amount DECIMAL(12,2) NOT NULL,
    paid_at TIMESTAMP,
    transaction_ref VARCHAR(80)
);
    
INSERT INTO fact_payment
SELECT
    p.payment_id,
    o.order_id,
    d.date_key,
    o.customer_key,
    o.channel_key,
    o.province_key,
    o.store_key,
    p.method,
    p.status,
    p.amount,
    p.paid_at,
    p.transaction_ref
FROM raw.payment AS p
INNER JOIN fact_sales_order AS o 
    ON p.order_id = o.order_id
LEFT JOIN dim_date AS d --LEFT JOIN porque puede ser NULL si el pago no se realizó (PENDING o FAILED)
    ON d.full_date = CAST(p.paid_at AS DATE)
    

