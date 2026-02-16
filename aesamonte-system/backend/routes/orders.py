from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import date, timedelta
import json

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

# ===================== SUMMARY =====================
@orders_bp.route("/summary", methods=["GET"])
def orders_summary():
    conn = get_connection()
    cur = conn.cursor()

    today = date.today()
    yesterday = today - timedelta(days=1)

    def count_orders(status_code, for_date=None):
        query = """
            SELECT COUNT(*)
            FROM order_transaction ot
            JOIN status_like sl ON ot.order_status_id = sl.status_id
            WHERE sl.status_scope = 'ORDER_STATUS'
              AND sl.status_code = %s
        """
        params = [status_code]
        if for_date:
            query += " AND ot.order_date = %s"
            params.append(for_date)
        cur.execute(query, params)
        return cur.fetchone()[0]

    shipped_today = count_orders("RECEIVED", today)
    shipped_yesterday = count_orders("RECEIVED", yesterday)
    total_shipped = count_orders("RECEIVED")
    cancelled_today = count_orders("CANCELLED", today)
    cancelled_yesterday = count_orders("CANCELLED", yesterday)

    cur.execute("SELECT COUNT(*) FROM order_transaction")
    total_orders = cur.fetchone()[0]

    cur.close()
    conn.close()

    return jsonify({
        "shippedToday": {
            "current": shipped_today,
            "total": total_shipped,
            "yesterday": shipped_yesterday
        },
        "cancelled": {
            "current": cancelled_today,
            "yesterday": cancelled_yesterday
        },
        "totalOrders": {
            "count": total_orders,
            "growth": 3.1  # Placeholder; calculate dynamically if needed
        }
    })


# ===================== LIST =====================
@orders_bp.route("/list", methods=["GET"])
def orders_list():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            ot.order_id,
            c.customer_name,
            ot.order_date,
            sl.status_code AS order_status,
            COALESCE(json_agg(
                json_build_object(
                    'inventory_id', od.inventory_id,
                    'order_quantity', od.order_quantity,
                    'available_quantity', i.item_quantity,
                    'item_name', i.item_name
                )
            ) FILTER (WHERE od.order_id IS NOT NULL), '[]') AS items_json
        FROM order_transaction ot
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        LEFT JOIN order_details od ON od.order_id = ot.order_id
        LEFT JOIN inventory i ON i.inventory_id = od.inventory_id
        WHERE sl.status_scope = 'ORDER_STATUS'
        GROUP BY ot.order_id, c.customer_name, ot.order_date, sl.status_code
        ORDER BY ot.order_id DESC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    orders = []

    for row in rows:
        order_id, customer_name, order_date, order_status, items_json = row
        order_status_upper = (order_status or "").upper()

        # Ensure items_json is a Python list
        if isinstance(items_json, str):
            try:
                items_list = json.loads(items_json)
            except json.JSONDecodeError:
                items_list = []
        else:
            items_list = items_json or []

        problematic_items = []

        if order_status_upper == "PREPARING":
            for item in items_list:
                order_qty = item.get('order_quantity') or 0
                available_qty = item.get('available_quantity') or 0
                item_name = item.get('item_name') or 'Unknown'

                if available_qty < order_qty:
                    problematic_items.append(f"{item_name} ({available_qty}/{order_qty})")

        availability_status = "Out of Stock" if problematic_items else None

        orders.append({
            "id": order_id,
            "customer": customer_name,
            "date": order_date.strftime("%m/%d/%y") if order_date else None,
            "status": order_status_upper.replace("_", " ").title(),
            "availabilityStatus": availability_status,
            "problematicItems": problematic_items
        })

    return jsonify(orders)
