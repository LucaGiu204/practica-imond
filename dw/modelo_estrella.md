# Modelo estrella

Generado por `run_sql.py` a partir de las tablas de `warehouse.duckdb`.

```mermaid
erDiagram
    dim_channel ||--o{ fact_payment : "channel_key"
    dim_channel ||--o{ fact_sales_order : "channel_key"
    dim_channel ||--o{ fact_sales_order_item : "channel_key"
    dim_customer ||--o{ fact_payment : "customer_key"
    dim_customer ||--o{ fact_sales_order : "customer_key"
    dim_customer ||--o{ fact_sales_order_item : "customer_key"
    dim_date ||--o{ fact_payment : "payment_date_key"
    dim_date ||--o{ fact_sales_order : "date_key"
    dim_date ||--o{ fact_sales_order_item : "date_key"
    dim_product ||--o{ fact_sales_order_item : "product_key"
    dim_province ||--o{ fact_payment : "province_key"
    dim_province ||--o{ fact_sales_order : "province_key"
    dim_province ||--o{ fact_sales_order_item : "province_key"
    dim_store ||--o{ fact_payment : "store_key"
    dim_store ||--o{ fact_sales_order : "store_key"
    dim_store ||--o{ fact_sales_order_item : "store_key"
    dim_channel {
        INTEGER channel_key PK
        INTEGER channel_id
        VARCHAR code
        VARCHAR name
    }
    dim_customer {
        INTEGER customer_key PK
        INTEGER customer_id
        VARCHAR email
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR phone
        VARCHAR status
        TIMESTAMP created_at
    }
    dim_date {
        INTEGER date_key PK
        DATE full_date
        SMALLINT year
        TINYINT month
        TINYINT day
        TINYINT quarter
        VARCHAR year_month
    }
    dim_product {
        INTEGER product_key PK
        INTEGER product_id
        VARCHAR sku
        VARCHAR name
        VARCHAR category
        VARCHAR family
        DECIMAL list_price
    }
    dim_province {
        INTEGER province_key PK
        INTEGER province_id
        VARCHAR name
        VARCHAR code
    }
    dim_store {
        INTEGER store_key PK
        INTEGER store_id
        VARCHAR name
        INTEGER address_id
    }
    fact_payment {
        BIGINT payment_id PK
        BIGINT order_id
        INTEGER payment_date_key FK
        INTEGER customer_key FK
        INTEGER channel_key FK
        INTEGER province_key FK
        INTEGER store_key FK
        VARCHAR method
        VARCHAR status
        DECIMAL amount
        TIMESTAMP paid_at
        VARCHAR transaction_ref
    }
    fact_sales_order {
        BIGINT order_id PK
        INTEGER date_key FK
        INTEGER customer_key FK
        INTEGER channel_key FK
        INTEGER province_key FK
        INTEGER store_key FK
        TIMESTAMP order_date
        VARCHAR status
        VARCHAR currency_code
        DECIMAL subtotal
        DECIMAL tax_amount
        DECIMAL shipping_fee
        DECIMAL discount_total
        DECIMAL total_amount
    }
    fact_sales_order_item {
        BIGINT order_item_id PK
        BIGINT order_id
        INTEGER product_key FK
        INTEGER date_key FK
        INTEGER customer_key FK
        INTEGER channel_key FK
        INTEGER province_key FK
        INTEGER store_key FK
        TIMESTAMP order_date
        VARCHAR status
        INTEGER quantity
        DECIMAL unit_price
        DECIMAL discount_amount
        DECIMAL line_total
    }
```
