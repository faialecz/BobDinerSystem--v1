from flask import Blueprint, jsonify
from database.db_config import get_connection

inventory_bp = Blueprint("inventory", __name__)

@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            i.inventory_id,
            i.inventory_item_name,
            i.brand,
            i.item_quantity,
            u.status_name AS uom,
            s.status_name AS item_status,
            i.item_unit_price,
            i.item_selling_price
        FROM inventory i
        LEFT JOIN status_like u ON i.unit_of_measure = u.status_id
        LEFT JOIN status_like s ON i.item_status_id = s.status_id
        ORDER BY i.inventory_id ASC
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = [
        {
            "id": str(r[0]),
            "item": r[1],
            "brand": r[2],
            "qty": r[3],
            "uom": r[4],
            "status": r[5],
            "unitPrice": float(r[6]),
            "price": float(r[7]),
        }
        for r in rows
    ]

    return jsonify(result)
