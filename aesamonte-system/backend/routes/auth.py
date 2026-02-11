# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    employee_id = int(data.get('employee_id')) # Match frontend key
    password = data.get('password')

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Query specifically by employee_id
        cur.execute("""
            SELECT e.employee_id, e.role_id, e.employee_password, r.role_name 
            FROM employee e
            JOIN employee_role r ON e.role_id = r.role_id
            WHERE e.employee_id = %s
        """, (employee_id,))
        
        user = cur.fetchone()

        if user and user['employee_password'] == password:
            # Audit log using the retrieved employee_id
            '''cur.execute("""
                INSERT INTO Employee_Audit_Log (employee_id, role_id, employee_audit_log_type)
                VALUES (%s, %s, 'LOGIN')
            """, (user['employee_id'], user['role_id']))
            conn.commit()'''
            return jsonify({
                "status": "success", 
                "role": user['role_name']
            }), 200
        
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401
    finally:
        cur.close()
        conn.close()