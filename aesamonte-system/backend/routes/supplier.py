from flask import Blueprint, jsonify
from database.db_config import get_connection
from flask import request, jsonify

supplier_bp = Blueprint("supplier", __name__, url_prefix="/api/suppliers")

# ===================== LIST SUPPLIERS =====================
@supplier_bp.route("", methods=["GET"])
def get_suppliers():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                s.supplier_id,
                s.supplier_name,
                s.contact_person,
                s.supplier_contact,
                s.supplier_email,
                s.supplier_address,
                st.status_name AS supplier_status,
                st.status_code
            FROM supplier s
            LEFT JOIN static_status st
                ON s.supplier_status_id = st.status_id
            WHERE st.status_scope = 'SUPPLIER_STATUS'
            ORDER BY s.supplier_id DESC
        """)
        rows = cur.fetchall()
    except Exception as e:
        print("Supplier GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

    suppliers = [
        {
            "supplier_id": r[0],
            "supplier_name": r[1],
            "contact_person": r[2],
            "supplier_contact": r[3],
            "supplier_email": r[4],
            "supplier_address": r[5],
            "status": r[6],
            "is_archived": r[7] == 'INACTIVE'
        }
        for r in rows
    ]

    return jsonify(suppliers)

  # ===================== CREATE SUPPLIER =====================
@supplier_bp.route("", methods=["POST"])
def create_supplier():
    data = request.get_json()

    supplier_name = data.get("supplierName")
    address = data.get("address")
    contact_person = data.get("contactPerson")
    contact_number = data.get("contactNumber")
    email = data.get("email")
    payment_terms_label = data.get("paymentTerms")

    if not supplier_name:
        return jsonify({"error": "Supplier name is required."}), 400

    payment_terms_map = {
        "Cash on Delivery": 17,
        "Card": 19
    }
    payment_terms_id = payment_terms_map.get(payment_terms_label, 17)

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT status_id FROM static_status 
            WHERE status_scope = 'SUPPLIER_STATUS' AND status_code = 'ACTIVE'
        """)
        status_row = cur.fetchone()
        if not status_row:
            return jsonify({"error": "Active status not found."}), 500
        active_status_id = status_row[0]

        cur.execute("""
            INSERT INTO supplier 
                (supplier_name, supplier_address, contact_person, supplier_contact, supplier_email, payment_terms, supplier_status_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (supplier_name, address, contact_person, contact_number, email, payment_terms_id, active_status_id))

        conn.commit()
        return jsonify({"message": "Supplier created successfully!"}), 201

    except Exception as e:
        conn.rollback()
        print("Error creating supplier:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

        # ===================== EDIT SUPPLIER =====================
@supplier_bp.route("/<string:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()

        cur.execute("""
            UPDATE supplier SET
                supplier_name = %s,
                supplier_address = %s,
                contact_person = %s,
                supplier_contact = %s,
                supplier_email = %s
            WHERE supplier_id = %s
        """, (
            data.get("supplierName"),
            data.get("address"),
            data.get("contactPerson"),
            data.get("contactNumber"),
            data.get("email"),
            supplier_id
        ))

        conn.commit()
        return jsonify({"message": "Supplier updated successfully!"}), 200

    except Exception as e:
        conn.rollback()
        print("Update Error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
# ===================== TOGGLE ARCHIVE =====================
@supplier_bp.route("/archive/<string:supplier_id>", methods=["PUT", "OPTIONS"])
def toggle_supplier_archive(supplier_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT ss.status_code
            FROM supplier s
            JOIN static_status ss ON s.supplier_status_id = ss.status_id
            WHERE s.supplier_id = %s
        """, (supplier_id,))

        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Supplier not found."}), 404

        current_status = row[0]

        if current_status == 'INACTIVE':
            cur.execute("""
                SELECT status_id FROM static_status 
                WHERE status_scope = 'SUPPLIER_STATUS' AND status_code = 'ACTIVE'
            """)
            is_archived = False
            action_msg = "Restored from Archive"
        else:
            cur.execute("""
                SELECT status_id FROM static_status 
                WHERE status_scope = 'SUPPLIER_STATUS' AND status_code = 'INACTIVE'
            """)
            is_archived = True
            action_msg = "Moved to Archive"

        res = cur.fetchone()
        if not res:
            return jsonify({"error": "Target status not found in static_status."}), 404

        new_status_id = res[0]

        cur.execute("""
            UPDATE supplier SET supplier_status_id = %s WHERE supplier_id = %s
        """, (new_status_id, supplier_id))

        conn.commit()

        return jsonify({
            "message": action_msg,
            "is_archived": is_archived
        }), 200

    except Exception as e:
        conn.rollback()
        print("Error toggling supplier archive:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()