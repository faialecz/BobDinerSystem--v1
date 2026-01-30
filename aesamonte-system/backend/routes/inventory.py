from flask import Blueprint, jsonify
from database.db_config import get_connection

inventory_bp = Blueprint("inventory", __name__)

@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            inventory_id,
            inventory_item_name,
            brand,
            item_quantity,
            unit_of_measure,
            item_status,
            item_unit_price,
            item_selling_price
        FROM inventory
        ORDER BY inventory_id ASC
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify([
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
    ])
