# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    employee_id = int(data.get('employee_id')) 
    password = data.get('password')

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
            SELECT e.employee_id, e.role_id, r.role_name
            FROM employee e
            JOIN employee_role r ON e.role_id = r.role_id
            WHERE e.employee_id = %s
              AND e.employee_password = crypt(%s, e.employee_password)
        """, (employee_id, password))
        
        user = cur.fetchone()

        if user:
            return jsonify({
                "status": "success",
                "role": user['role_name']
            }), 200

        return jsonify({"status": "error", "message": "Invalid credentials"}), 401

    finally:
        cur.close()
        conn.close()