from flask import Blueprint, request, jsonify
from database.db_config import get_connection
import bcrypt

users_bp = Blueprint("users", __name__)

@users_bp.route("/employees", methods=["GET"])
def get_employees():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT 
                employee_id,
                employee_name,
                employee_email,
                employee_contact,
                role_id,
                employee_status_id
            FROM employee
            ORDER BY employed_date DESC
        """)

        rows = cursor.fetchall()

        employees = [
            {
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "contact": row[3],
                "role_id": row[4],
                "status_id": row[5]
            }
            for row in rows
        ]

        return jsonify(employees)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@users_bp.route("/employees", methods=["POST"])
def create_employee():
    data = request.json

    name = data.get("name")
    email = data.get("email")
    role_id = data.get("role_id")
    contact = data.get("contact")
    password = data.get("password")

    if not all([name, email, role_id, password]):
        return jsonify({"error": "Missing required fields"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    # Check duplicate email
    cursor.execute(
        "SELECT employee_id FROM employee WHERE employee_email = %s",
        (email,)
    )
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"error": "Email already exists"}), 409

    hashed_password = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    try:
        cursor.execute("""
            INSERT INTO employee (
                employee_name,
                employee_email,
                employee_contact,
                employee_password,
                role_id,
                employed_date,
                employee_status_id
            )
            VALUES (%s, %s, %s, %s, %s, CURRENT_DATE, 8)
        """, (
            name,
            email,
            contact,
            hashed_password,
            role_id
        ))

        conn.commit()

        return jsonify({"message": "Employee created successfully"}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()