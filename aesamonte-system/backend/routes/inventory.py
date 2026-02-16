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
            i.item_name,
            i.item_description,
            i.item_sku,
            i.brand,
            i.item_quantity,
            u.uom_name AS uom,  
            s.status_name AS item_status,
            i.item_unit_price,
            i.item_selling_price
        FROM inventory i
        LEFT JOIN unit_of_measure u ON i.unit_of_measure = u.uom_id
        LEFT JOIN status_like s ON i.item_status_id = s.status_id AND s.status_scope='INVENTORY_STATUS'
        ORDER BY i.inventory_id ASC;
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    for r in rows:
        stock_qty = r[5]
        # Determine display status if needed
        display_status = r[7]  # use status from status_like directly

        result.append({
            "id": str(r[0]),
            "item_name": r[1],
            "item_description": r[2],
            "sku": r[3],
            "brand": r[4],
            "qty": r[5],
            "uom": r[6] or '—',
            "status": "Out of Stock" if r[5] <= 0 else f"Low Stock ({r[5]})" if r[5] <= 5 else "Available",
            "unitPrice": float(r[8]),
            "price": float(r[9])
        })

    return jsonify(result)
