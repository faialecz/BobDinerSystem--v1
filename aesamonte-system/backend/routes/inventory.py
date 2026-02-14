from flask import Blueprint, jsonify
from database.db_config import get_connection
from flask import request

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

@inventory_bp.route("/api/inventory/add", methods=["POST"])
def add_inventory_item():
    data = request.get_json()
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO suppliers (supplier_name, contact_person, contact_number)
            VALUES (%s, %s, %s)
            ON CONFLICT (supplier_name) DO UPDATE 
            SET supplier_name = EXCLUDED.supplier_name
            RETURNING supplier_id;
        """, (data['supplierName'], data['detailContactPerson'], data['detailContactNumber']))
        
        supplier_id = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO inventory (
                inventory_item_name, brand, internal_sku, item_quantity, 
                unit_of_measure, reorder_point, item_unit_price, 
                item_selling_price, supplier_id, item_status_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data['itemName'], data['brand'], data['internalSku'],
            data['qty'], 1,
            data['reorderPoint'], data['unitPrice'], data['sellingPrice'], 
            supplier_id, 1
        ))

        conn.commit()
        return jsonify({"message": "Successfully added item and supplier"}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()