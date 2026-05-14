from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta

reports_bp = Blueprint("reports", __name__)

def parse_dates():
    """
    Pull start_date / end_date from query-string.
    - start only  → exact day  (end = start)
    - start + end → inclusive range
    Uses >= start AND < end+1 so timestamp columns are fully covered.
    """
    start_str = request.args.get("start_date")
    end_str   = request.args.get("end_date")
    today     = date.today()
    try:
        start = date.fromisoformat(start_str) if start_str else date(2000, 1, 1)
    except ValueError:
        start = date(2000, 1, 1)
    try:
        # if no end_date, use start so it's an exact-day filter
        end = date.fromisoformat(end_str) if end_str else start
    except ValueError:
        end = start
    if start > end:
        start, end = end, start
    # +1 day so "col >= start AND col < end_excl" covers the full end day
    end_excl = end + timedelta(days=1)
    print(f"[parse_dates] start={start}, end={end}, end_excl={end_excl}")
    return start, end_excl


def _fetch_action_map(cur):
    """
    Safely load inventory_action without assuming the FK column name.
    Detects the linking column dynamically from information_schema.
    Returns: dict[ inventory_brand_id_or_inventory_id → {reorder_qty, min_order_qty, lead_time_days, low_stock_qty} ]
    """
    try:
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'inventory_action'
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cur.fetchall()]
        if not cols:
            return {}

        fk_col = None
        for preferred in ('inventory_brand_id', 'inventory_id'):
            if preferred in cols:
                fk_col = preferred
                break
        if not fk_col:
            for c in cols:
                if 'inventory' in c.lower():
                    fk_col = c
                    break
        if not fk_col:
            print("[reports] inventory_action: FK column not found. Available:", cols)
            return {}

        cur.execute(
            f'SELECT "{fk_col}", low_stock_qty, reorder_qty, min_order_qty, lead_time_days '
            f'FROM inventory_action'
        )
        return {
            r[0]: {
                "low_stock_qty":  int(r[1] or 0),
                "reorder_qty":    int(r[2] or 0),
                "min_order_qty":  int(r[3] or 0),
                "lead_time_days": int(r[4] or 0),
            }
            for r in cur.fetchall()
        }
    except Exception as exc:
        print("[reports] inventory_action lookup error:", exc)
        return {}


def err(msg, code=500):
    return jsonify({"error": str(msg)}), code

@reports_bp.route("/api/reports/sales", methods=["GET"])
def get_sales_report():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        today          = date.today()
        start_of_week  = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)
        start_of_year  = today.replace(month=1, day=1)

        def get_sales(start_date):
            cur.execute("""
                SELECT COALESCE(SUM(ot.total_amount), 0)
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN static_status ss     ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
            """, (start_date,))
            return float(cur.fetchone()[0] or 0)

        return jsonify({
            "weekly":  get_sales(start_of_week),
            "monthly": get_sales(start_of_month),
            "yearly":  get_sales(start_of_year),
        }), 200
    except Exception as e:
        print("[reports/sales] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/extra", methods=["GET"])
def get_dashboard_extra():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        today            = date.today()
        this_month_start = today.replace(day=1)
        last_month_end   = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        current_day      = today.day
        try:
            last_month_same_day = last_month_start.replace(day=current_day)
        except ValueError:
            last_month_same_day = last_month_end

        # ── Total Orders ──
        cur.execute("SELECT COUNT(order_id) FROM order_transaction")
        total_orders = int(cur.fetchone()[0] or 0)

        cur.execute("SELECT COUNT(order_id) FROM order_transaction WHERE order_date >= %s", (this_month_start,))
        curr_orders = int(cur.fetchone()[0] or 0)

        cur.execute(
            "SELECT COUNT(order_id) FROM order_transaction WHERE order_date >= %s AND order_date <= %s",
            (last_month_start, last_month_same_day)
        )
        prev_orders = int(cur.fetchone()[0] or 0)
        orders_growth = (
            round(((curr_orders - prev_orders) / prev_orders) * 100, 1)
            if prev_orders > 0 else (100.0 if curr_orders > 0 else 0.0)
        )

        def paid_sales(start_d, end_d=None):
            if end_d:
                cur.execute("""
                    SELECT COALESCE(SUM(ot.total_amount), 0)
                    FROM sales_transaction st
                    JOIN order_transaction ot ON st.order_id = ot.order_id
                    JOIN static_status ss     ON st.payment_status_id = ss.status_id
                    WHERE ss.status_code = 'PAID' AND st.sales_date >= %s AND st.sales_date <= %s
                """, (start_d, end_d))
            else:
                cur.execute("""
                    SELECT COALESCE(SUM(ot.total_amount), 0)
                    FROM sales_transaction st
                    JOIN order_transaction ot ON st.order_id = ot.order_id
                    JOIN static_status ss     ON st.payment_status_id = ss.status_id
                    WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
                """, (start_d,))
            return float(cur.fetchone()[0] or 0)

        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss     ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
        """)
        total_sales = float(cur.fetchone()[0] or 0)

        curr_sales = paid_sales(this_month_start)
        prev_sales = paid_sales(last_month_start, last_month_same_day)
        sales_growth = (
            round(((curr_sales - prev_sales) / prev_sales) * 100, 1)
            if prev_sales > 0 else (100.0 if curr_sales > 0 else 0.0)
        )

        cur.execute("""
            SELECT c.customer_name, COUNT(ot.order_id) AS total_orders
            FROM order_transaction ot
            JOIN customer c ON ot.customer_id = c.customer_id
            GROUP BY c.customer_name
            ORDER BY total_orders DESC
            LIMIT 3
        """)
        top_clients_db = cur.fetchall()
        max_c = max((int(r[1]) for r in top_clients_db), default=1) or 1
        top_clients = [
            {"name": r[0] or "Unknown", "orders": int(r[1]),
             "percentage": round((int(r[1]) / max_c) * 100, 1)}
            for r in top_clients_db
        ]

        cur.execute("""
            SELECT i.item_name, COALESCE(SUM(bat.quantity_on_hand), 0) AS total_qty
            FROM inventory_brand ib
            JOIN inventory i      ON i.inventory_id = ib.inventory_id
            JOIN static_status ss ON ss.status_id   = i.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
            WHERE ss.status_scope = 'INVENTORY_STATUS' AND ss.status_code != 'INACTIVE'
            GROUP BY i.item_name
            ORDER BY total_qty DESC
            LIMIT 3
        """)
        most_stock_db = cur.fetchall()
        max_s = max((int(r[1]) for r in most_stock_db), default=1) or 1
        most_stock = [
            {"name": r[0] or "Unknown", "qty": int(r[1]),
             "percentage": round((int(r[1]) / max_s) * 100, 1)}
            for r in most_stock_db
        ]

        cur.execute("""
            SELECT EXTRACT(YEAR FROM st.sales_date) AS yr,
                   COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss     ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
            GROUP BY yr
            ORDER BY yr DESC
            LIMIT 8
        """)
        yh_db = cur.fetchall()
        max_y = max((float(r[1]) for r in yh_db), default=1) or 1
        yearly_history = [
            {"year": int(r[0] or today.year), "sales": float(r[1]),
             "percentage": round((float(r[1]) / max_y) * 100, 1)}
            for r in yh_db
        ]

        return jsonify({
            "totals":        {"orders": total_orders, "ordersGrowth": orders_growth,
                              "sales": total_sales, "salesGrowth": sales_growth},
            "topClients":    top_clients,
            "mostStock":     most_stock,
            "yearlyHistory": yearly_history,
        }), 200
    except Exception as e:
        print("[reports/extra] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/product-performance", methods=["GET"])
def report_product_performance():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        start_str = request.args.get("start_date")
        end_str   = request.args.get("end_date")
        if start_str or end_str:
            start, end = parse_dates()
            # Filter by date_added (MIN batch date_created) within the date range
            date_filter = ""
            params: tuple = (start, end)
            date_added_subquery = """(SELECT MIN(b2.date_created) FROM inventory_batch b2
                 WHERE b2.inventory_brand_id = ib.inventory_brand_id)"""
            date_added_where = "AND (SELECT MIN(b2.date_created) FROM inventory_batch b2 WHERE b2.inventory_brand_id = ib.inventory_brand_id) >= %s AND (SELECT MIN(b2.date_created) FROM inventory_batch b2 WHERE b2.inventory_brand_id = ib.inventory_brand_id) < %s"
            print(f"[product-performance] filtering date_added >= {start} AND < {end}")
        else:
            date_filter = ""
            params = ()
            date_added_subquery = """(SELECT MIN(b2.date_created) FROM inventory_batch b2
                 WHERE b2.inventory_brand_id = ib.inventory_brand_id)"""
            date_added_where = ""

        # Diagnostic: check what's in order_details and what dates exist
        cur.execute("""
            SELECT COUNT(*), COUNT(batch_id), COALESCE(SUM(order_quantity),0), COALESCE(SUM(order_total),0)
            FROM order_details WHERE is_archived IS NOT TRUE
        """)
        diag = cur.fetchone()
        print(f"[product-performance] order_details: rows={diag[0]}, with_batch={diag[1]}, qty={diag[2]}, revenue={diag[3]}")

        # Show actual date range in sales_transaction
        cur.execute("SELECT MIN(sales_date), MAX(sales_date) FROM sales_transaction")
        date_range = cur.fetchone()
        print(f"[product-performance] sales_transaction date range: {date_range[0]} → {date_range[1]}")
        if start_str or end_str:
            print(f"[product-performance] filtering date_added >= {start} AND < {end}")

        cur.execute(f"""
            SELECT
                i.item_name,
                COALESCE(b.brand_name, 'Generic')                                     AS brand_name,
                COALESCE(ib.item_sku, '—')                                            AS sku,
                COALESCE(u.uom_name, '—')                                             AS uom,
                COALESCE(sales.qty_sold, 0)                                           AS qty_sold,
                COALESCE(sales.qty_sold, 0) * COALESCE(ib.item_selling_price, 0)      AS gross_sales,
                COALESCE(sales.cogs, 0)                                               AS cogs,
                (COALESCE(sales.qty_sold, 0) * COALESCE(ib.item_selling_price, 0))
                    - COALESCE(sales.cogs, 0)                                         AS net_profit,
                {date_added_subquery}                                                 AS date_added,
                i.inventory_id                                                        AS inventory_id,
                ib.inventory_brand_id                                                 AS inventory_brand_id
            FROM inventory_brand ib
            JOIN  inventory        i   ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand        b   ON b.brand_id      = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id       = ib.uom_id
            JOIN  static_status  ss_i  ON ss_i.status_id  = i.item_status_id
            JOIN  static_status  ss_b  ON ss_b.status_id  = ib.item_status_id
            LEFT JOIN (
                SELECT
                    bat.inventory_brand_id,
                    SUM(od.order_quantity)                               AS qty_sold,
                    SUM(od.order_quantity * COALESCE(bat.unit_cost, 0))  AS cogs
                FROM order_details od
                JOIN inventory_batch bat ON bat.batch_id = od.batch_id
                JOIN order_transaction ot ON ot.order_id = od.order_id
                JOIN sales_transaction st ON st.order_id = ot.order_id
                WHERE od.is_archived IS NOT TRUE
                GROUP BY bat.inventory_brand_id
            ) sales ON sales.inventory_brand_id = ib.inventory_brand_id
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
              AND COALESCE(sales.qty_sold, 0) > 0
              {date_added_where}
            GROUP BY i.item_name, b.brand_name, ib.item_sku, u.uom_name,
                     sales.qty_sold, sales.cogs, ib.item_selling_price, i.inventory_id, ib.inventory_brand_id
            ORDER BY net_profit DESC
        """, params)
        rows = cur.fetchall()

        total_revenue = sum(float(r[5] or 0) for r in rows)

        result = []
        for r in rows:
            gross_sales  = float(r[5] or 0)
            net_profit   = float(r[7] or 0)
            date_added   = r[8]
            if date_added and hasattr(date_added, 'date'):
                date_added = date_added.date()
            contribution = round((gross_sales / total_revenue * 100), 2) if total_revenue > 0 else 0.0
            result.append({
                "item_name":    r[0],
                "brand_name":   r[1],
                "sku":          r[2],
                "uom":          r[3],
                "units_sold":   int(r[4] or 0),
                "revenue":      gross_sales,
                "cogs":         float(r[6] or 0),
                "gross_profit": net_profit,
                "margin_pct":   contribution,
                "date_added":          date_added.isoformat() if date_added else None,
                "inventory_id":        r[9],
                "inventory_brand_id":  r[10],
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/product-performance] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/inventory-valuation", methods=["GET"])
def report_inventory_valuation():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        start_str = request.args.get("start_date")
        end_str   = request.args.get("end_date")
        if start_str or end_str:
            start, end = parse_dates()
            val_params: tuple = (start, end)
        else:
            val_params = ()

        # Build WHERE clause and date_added subquery based on date range
        date_where = ""
        date_added_subquery = """(SELECT MIN(b2.date_created) FROM inventory_batch b2
                 WHERE b2.inventory_brand_id = ib.inventory_brand_id)"""
        if val_params:
            date_where = """
              AND (SELECT MIN(b2.date_created) FROM inventory_batch b2
                   WHERE b2.inventory_brand_id = ib.inventory_brand_id) >= %s
              AND (SELECT MIN(b2.date_created) FROM inventory_batch b2
                   WHERE b2.inventory_brand_id = ib.inventory_brand_id) < %s
            """
            date_added_subquery = f"""(SELECT MIN(b2.date_created) FROM inventory_batch b2
                 WHERE b2.inventory_brand_id = ib.inventory_brand_id
                   AND b2.date_created >= %s AND b2.date_created < %s)"""

        cur.execute(f"""
            SELECT
                COALESCE(ib.item_sku, '—')                                                   AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')                                             AS brand_name,
                COALESCE(u.uom_name, '—')                                                     AS uom,
                COALESCE(SUM(bat.quantity_on_hand), 0)                                        AS qty_on_hand,
                COALESCE(fefo.unit_cost, 0)                                                   AS unit_cost,
                COALESCE(ib.item_selling_price, 0)                                            AS selling_price,
                (COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(ib.item_selling_price, 0))
                    - (COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(fefo.unit_cost, 0))  AS potential_profit,
                ss_b.status_code                                                               AS brand_status,
                MIN(bat.expiry_date)                                                           AS expiry_date,
                {date_added_subquery}                                                          AS date_added,
                i.inventory_id                                                                 AS inventory_id,
                ib.inventory_brand_id                                                          AS inventory_brand_id
            FROM inventory_brand ib
            JOIN inventory       i    ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand      b    ON b.brand_id       = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id       = ib.uom_id
            JOIN static_status   ss_i ON ss_i.status_id  = i.item_status_id
            JOIN static_status   ss_b ON ss_b.status_id  = ib.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
            LEFT JOIN LATERAL (
                SELECT unit_cost FROM inventory_batch
                WHERE inventory_brand_id = ib.inventory_brand_id
                  AND expiry_date > CURRENT_DATE
                  AND batch_status_id != (
                      SELECT status_id FROM static_status
                      WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                  )
                ORDER BY expiry_date ASC
                LIMIT 1
            ) fefo ON TRUE
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
              {date_where}
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, ib.item_selling_price, fefo.unit_cost, ss_b.status_code, i.inventory_id
            HAVING COALESCE(SUM(bat.quantity_on_hand), 0) > 0
            ORDER BY (COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(ib.item_selling_price, 0))
                    - (COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(fefo.unit_cost, 0)) DESC
        """, val_params * 2 if val_params else val_params)
        rows = cur.fetchall()
        result = []
        for r in rows:
            qty           = int(r[4] or 0)
            unit_cost     = float(r[5] or 0)
            selling_price = float(r[6] or 0)
            brand_status  = r[8] or ''
            expiry_raw    = r[9]
            date_added_raw = r[10]
            if expiry_raw and hasattr(expiry_raw, 'date'):
                expiry_raw = expiry_raw.date()
            if date_added_raw and hasattr(date_added_raw, 'date'):
                date_added_raw = date_added_raw.date()
            days_to_expiry = (expiry_raw - date.today()).days if expiry_raw else None

            # Stock status
            if brand_status == 'ARCHIVED':
                stock_status = 'Archived'
            elif qty == 0 or brand_status == 'OUT_OF_STOCK':
                stock_status = 'Out of Stock'
            elif days_to_expiry is not None and days_to_expiry <= 30:
                stock_status = 'Expiring Soon'
            elif brand_status == 'LOW_STOCK':
                stock_status = 'Low Stock'
            else:
                stock_status = 'Available'

            total_cost_value = round(qty * unit_cost, 2)
            potential_profit = round(qty * (selling_price - unit_cost), 2)

            # Margin-based profit status: ≥20% = Profitable, 0–20% = Break-even, <0% = Loss
            if selling_price > 0:
                margin_pct = (selling_price - unit_cost) / selling_price * 100
            else:
                margin_pct = 0.0

            if margin_pct >= 20:
                profit_status = 'Profitable'
            elif margin_pct < 0:
                profit_status = 'Loss'
            else:
                profit_status = 'Break-even'

            result.append({
                "sku":               r[0], "item_name": r[1], "brand_name": r[2], "uom": r[3],
                "qty_on_hand":       qty,
                "unit_cost":         unit_cost,
                "selling_price":     selling_price,
                "total_cost_value":  total_cost_value,
                "potential_profit":  potential_profit,
                "margin_pct":        round(margin_pct, 1),
                "profit_status":     profit_status,
                "stock_status":        stock_status,
                "expiry_date":         expiry_raw.isoformat() if expiry_raw else None,
                "date_added":          date_added_raw.isoformat() if date_added_raw else None,
                "inventory_id":        r[11],
                "inventory_brand_id":  r[12],
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/inventory-valuation] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/stock-ageing", methods=["GET"])
def report_stock_ageing():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        today = date.today()
        start_str  = request.args.get("start_date")
        end_str    = request.args.get("end_date")
        date_field = request.args.get("date_field", "last_sale_date")  # last_sale_date | earliest_expiry | date_added

        date_filter      = ""
        sale_date_filter = ""
        expiry_filter    = ""
        date_added_filter = ""
        params: tuple = ()

        if start_str or end_str:
            try:
                start = date.fromisoformat(start_str) if start_str else date(2000, 1, 1)
                end   = date.fromisoformat(end_str) if end_str else start
            except ValueError:
                start = date(2000, 1, 1); end = start
            if start > end:
                start, end = end, start
            end_excl = end + timedelta(days=1)
            print(f"[stock-ageing] date_field={date_field}, filtering >= {start} AND < {end_excl}")

            if date_field == "date_added":
                date_filter = "AND bat.date_created >= %s AND bat.date_created < %s"
                params = (start, end_excl, start, end_excl)  # date_filter + sale_date_filter (sale unused but keeps tuple shape)
                sale_date_filter = ""
                params = (start, end_excl)  # only date_filter needs params
            elif date_field == "earliest_expiry":
                expiry_filter = "AND bat.expiry_date >= %s AND bat.expiry_date < %s"
                params = (start, end_excl)
            else:  # last_sale_date (default)
                sale_date_filter = "AND st.sales_date >= %s AND st.sales_date < %s"
                params = (start, end_excl)

        cur.execute(f"""
            SELECT
                i.item_name,
                STRING_AGG(DISTINCT COALESCE(b.brand_name, 'Generic'), ', ') AS brand_names,
                COALESCE(ib.item_sku, '-')                                    AS sku,
                (
                    SELECT STRING_AGG(b2.batch_id::text, ', ' ORDER BY b2.batch_id)
                    FROM inventory_batch b2
                    WHERE b2.inventory_brand_id = ib.inventory_brand_id
                      AND b2.quantity_on_hand > 0
                      AND b2.batch_status_id != (
                          SELECT status_id FROM static_status
                          WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                      )
                )                                                             AS batch_ids,
                COALESCE(SUM(bat.quantity_on_hand), 0)                        AS qty_on_hand,
                MAX(bat.date_created)                                         AS last_received_date,
                COALESCE(fefo.unit_cost, 0)                                   AS unit_cost,
                MAX(st.sales_date)                                            AS last_sale_date,
                MIN(bat.expiry_date)                                          AS earliest_expiry,
                ib.inventory_brand_id                                         AS inventory_brand_id,
                i.inventory_id                                                AS inventory_id,
                COALESCE(ib.item_selling_price, 0)                            AS selling_price
            FROM inventory_brand ib
            JOIN inventory       i    ON i.inventory_id   = ib.inventory_id
            LEFT JOIN brand      b    ON b.brand_id        = ib.brand_id
            JOIN static_status   ss_i ON ss_i.status_id   = i.item_status_id
            JOIN static_status   ss_b ON ss_b.status_id   = ib.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.quantity_on_hand > 0
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
                {date_filter}
                {expiry_filter}
            LEFT JOIN LATERAL (
                SELECT unit_cost FROM inventory_batch
                WHERE inventory_brand_id = ib.inventory_brand_id
                  AND quantity_on_hand > 0
                  AND batch_status_id != (
                      SELECT status_id FROM static_status
                      WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                  )
                ORDER BY expiry_date ASC NULLS LAST, batch_id ASC
                LIMIT 1
            ) fefo ON TRUE
            LEFT JOIN order_details od ON od.batch_id IN (
                SELECT batch_id FROM inventory_batch
                WHERE inventory_brand_id = ib.inventory_brand_id
            ) AND od.is_archived = FALSE
            LEFT JOIN order_transaction ot ON ot.order_id = od.order_id
            LEFT JOIN sales_transaction st ON st.order_id = ot.order_id
                AND (TRUE {sale_date_filter})
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            GROUP BY ib.inventory_brand_id, i.item_name, ib.item_sku, fefo.unit_cost, i.inventory_id, ib.item_selling_price
            ORDER BY last_received_date ASC NULLS FIRST, i.item_name
        """, params)
        rows = cur.fetchall()
        HOLDING_RATE = 0.025

        result = []
        for r in rows:
            qty           = int(r[4] or 0)
            last_received = r[5]
            unit_cost     = float(r[6] or 0)
            last_sale     = r[7]
            earliest_expiry = r[8]

            if qty == 0:
                continue

            if last_received and hasattr(last_received, 'date'):
                last_received = last_received.date()
            if last_sale and hasattr(last_sale, 'date'):
                last_sale = last_sale.date()
            if earliest_expiry and hasattr(earliest_expiry, 'date'):
                earliest_expiry = earliest_expiry.date()

            days_in = (today - last_received).days if last_received else None
            days_since_sale = (today - last_sale).days if last_sale else None
            never_sold = last_sale is None

            if days_in is None or days_in <= 30:
                ageing_label       = 'Active Stock'
                recommended_action = 'Maintain'
            elif days_in <= 60:
                ageing_label       = 'Slow-Moving'
                recommended_action = 'Maintain'
            elif days_in <= 90:
                ageing_label       = 'Stagnant'
                recommended_action = 'Promote / Bundle'
            else:
                if never_sold:
                    ageing_label       = 'Non-Mover'
                    recommended_action = 'Liquidate / Discount'
                elif days_since_sale is not None and days_since_sale <= 60:
                    ageing_label       = 'Stagnant'
                    recommended_action = 'Promote / Bundle'
                else:
                    ageing_label       = 'Dead Stock'
                    recommended_action = 'Liquidate / Discount'

            total_cost_value = qty * unit_cost
            holding_cost     = round(total_cost_value * HOLDING_RATE, 2)

            if earliest_expiry:
                days_to_expiry = (earliest_expiry - today).days
                if days_to_expiry < 0:
                    expiry_status = 'Expired'
                elif days_to_expiry < 30:
                    expiry_status = 'Critical'
                elif days_to_expiry <= 90:
                    expiry_status = 'Near Expiry'
                elif days_to_expiry <= 1095:
                    expiry_status = 'Stable'
                else:
                    expiry_status = 'Stable'
            else:
                days_to_expiry = None
                expiry_status  = ''

            if expiry_status == 'Expired':
                recommended_action = 'Dispose / Write-off'

            result.append({
                "item_name":           r[0],
                "brand_name":          r[1] or "—",
                "sku":                 r[2] or "—",
                "batch_ids":           r[3] or "—",
                "qty_on_hand":         qty,
                "last_received_date":  last_received.isoformat() if last_received else None,
                "unit_cost":           float(r[6] or 0),
                "selling_price":       float(r[11] or 0),
                "last_sale_date":      last_sale.isoformat() if last_sale else None,
                "earliest_expiry":     earliest_expiry.isoformat() if earliest_expiry else None,
                "expiry_status":       expiry_status,
                "days_to_expiry":      days_to_expiry,
                "days_in_inventory":   days_in,
                "ageing_label":        ageing_label,
                "value_of_aged_stock": round(total_cost_value, 2),
                "holding_cost":        holding_cost,
                "recommended_action":  recommended_action,
                "inventory_brand_id":  r[9],
                "inventory_id":        r[10],
            })

        EXPIRY_PRIORITY = {'Critical': 0, 'Near Expiry': 1, 'Expired': 2, '': 3, 'Stable': 4}
        AGEING_PRIORITY = {'Dead Stock': 0, 'Non-Mover': 1, 'Stagnant': 2, 'Slow-Moving': 3, 'Active Stock': 4}
        result.sort(key=lambda x: (
            EXPIRY_PRIORITY.get(x['expiry_status'], 3),
            AGEING_PRIORITY.get(x['ageing_label'], 9),
            x['days_to_expiry'] if x['days_to_expiry'] is not None else 9999,
        ))

        return jsonify(result), 200
    except Exception as e:
        print("[reports/stock-ageing] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/reorder", methods=["GET"])
def report_reorder():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        action_map = _fetch_action_map(cur)

        cur.execute("""
            SELECT
                COALESCE(ib.item_sku, '—')                    AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')              AS brand_name,
                COALESCE(u.uom_name, '—')                      AS uom,
                COALESCE(SUM(bat.quantity_on_hand), 0)         AS qty_on_hand,
                i.inventory_id,
                ib.inventory_brand_id,
                COALESCE(s.supplier_name,    '—')              AS primary_supplier,
                COALESCE(s.supplier_contact, '—')              AS supplier_contact
            FROM inventory_brand ib
            JOIN inventory         i    ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand        b    ON b.brand_id      = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id        = ib.uom_id
            JOIN static_status     ss_i ON ss_i.status_id = i.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
            LEFT JOIN LATERAL (
                SELECT s2.supplier_name, s2.supplier_contact
                FROM inventory_brand_supplier ibs2
                JOIN supplier s2 ON s2.supplier_id = ibs2.supplier_id
                WHERE ibs2.inventory_brand_id = ib.inventory_brand_id
                ORDER BY ibs2.inventory_brand_supplier_id
                LIMIT 1
            ) s ON TRUE
            WHERE ss_i.status_code != 'INACTIVE'
              AND EXISTS (
                SELECT 1 FROM static_status ss_b2
                WHERE ss_b2.status_id = ib.item_status_id
                  AND ss_b2.status_code != 'ARCHIVED'
              )
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, i.inventory_id,
                     s.supplier_name, s.supplier_contact
            ORDER BY i.item_name, b.brand_name
        """)
        rows = cur.fetchall()

        result = []
        for r in rows:
            inv_id  = r[5]
            ibrand_id = r[6]
            qty     = int(r[4] or 0)
            action  = action_map.get(ibrand_id) or action_map.get(inv_id) or {}
            reorder_qty   = action.get("reorder_qty",   0)
            low_stock_qty = action.get("low_stock_qty", 0)
            min_order_qty = action.get("min_order_qty", 0)
            lead_time     = action.get("lead_time_days", 0)

            threshold = reorder_qty or low_stock_qty
            if threshold <= 0 or qty > threshold:
                continue

            suggested = max(min_order_qty, threshold - qty)

            result.append({
                "sku":                 r[0],
                "item_name":           r[1],
                "brand_name":          r[2],
                "uom":                 r[3],
                "qty_on_hand":         qty,
                "reorder_point":       threshold,
                "min_order_qty":       min_order_qty,
                "lead_time_days":      lead_time,
                "suggested_order_qty": suggested,
                "primary_supplier":    r[7],
                "supplier_contact":    r[8],
            })

        result.sort(key=lambda x: x["qty_on_hand"] - x["reorder_point"])
        return jsonify(result), 200
    except Exception as e:
        print("[reports/reorder] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/customer-sales", methods=["GET"])
def report_customer_sales():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        start_str = request.args.get("start_date")
        end_str   = request.args.get("end_date")
        date_clause = ""
        cs_params: tuple = ()
        if start_str or end_str:
            start, end = parse_dates()
            date_clause = "AND ot.order_date >= %s AND ot.order_date < %s"
            cs_params = (start, end)
            # Diagnostic
            cur.execute("SELECT MIN(order_date), MAX(order_date) FROM order_transaction")
            dr = cur.fetchone()
            print(f"[customer-sales] order_transaction date range: {dr[0]} → {dr[1]}")
            print(f"[customer-sales] filtering: order_date >= {start} AND order_date < {end}")

        cur.execute(f"""
            SELECT
                c.customer_name,
                COUNT(DISTINCT ot.order_id)                AS total_orders,
                COALESCE(SUM(DISTINCT ot.total_amount), 0) AS total_revenue,
                MAX(ot.order_date)                         AS last_purchase_date,
                COALESCE(SUM(DISTINCT ot.total_amount) FILTER (
                    WHERE ot.order_date >= DATE_TRUNC('month', CURRENT_DATE)
                ), 0) AS this_month,
                COALESCE(SUM(DISTINCT ot.total_amount) FILTER (
                    WHERE ot.order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                      AND ot.order_date <  DATE_TRUNC('month', CURRENT_DATE)
                ), 0) AS last_month,
                (
                    SELECT STRING_AGG(DISTINCT pm2.status_name, ', ')
                    FROM order_transaction ot3
                    JOIN static_status pm2 ON pm2.status_id = ot3.payment_method_id
                    WHERE ot3.customer_id = c.customer_id
                ) AS preferred_payment
            FROM order_transaction  ot
            JOIN customer           c  ON c.customer_id  = ot.customer_id
            WHERE 1=1
            {date_clause}
            GROUP BY c.customer_id, c.customer_name
            ORDER BY total_revenue DESC
        """, cs_params)
        rows = cur.fetchall()

        result = []
        for r in rows:
            last_date  = r[3]
            this_month = float(r[4] or 0)
            last_month = float(r[5] or 0)
            if last_month == 0 and this_month == 0:
                ltv_trend = 'new'
            elif last_month == 0:
                ltv_trend = 'up'
            elif this_month > last_month:
                ltv_trend = 'up'
            elif this_month < last_month:
                ltv_trend = 'down'
            else:
                ltv_trend = 'flat'

            days_inactive = (date.today() - last_date).days if last_date else None
            if days_inactive is None:
                activity_status = 'Unknown'
            elif days_inactive <= 14:
                activity_status = 'Active'
            elif days_inactive <= 50:
                activity_status = 'Inactive'
            else:
                activity_status = 'Dormant'

            # Spending insight
            if this_month == 0 or last_month == 0:
                spending_insight = ""
            else:
                diff = this_month - last_month
                pct  = abs(round((diff / last_month) * 100, 1))
                if diff > 0:
                    spending_insight = f"↑ {pct}% vs last month"
                elif diff < 0:
                    spending_insight = f"↓ {pct}% vs last month"
                else:
                    spending_insight = ""

            result.append({
                "customer_name":      r[0] or "Unknown",
                "total_orders":       int(r[1] or 0),
                "total_revenue":      float(r[2] or 0),
                "last_purchase_date": last_date.isoformat() if last_date else None,
                "days_inactive":      days_inactive,
                "activity_status":    activity_status,
                "ltv_trend":          ltv_trend,
                "this_month":         this_month,
                "last_month":         last_month,
                "spending_insight":   spending_insight,
                "preferred_payment":  r[6] or "—",
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/customer-sales] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()