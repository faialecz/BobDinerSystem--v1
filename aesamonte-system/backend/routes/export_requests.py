# backend/routes/export_requests.py
from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor

export_requests_bp = Blueprint('export_requests', __name__)


@export_requests_bp.route('/api/export-requests', methods=['POST'])
def create_export_request():
    data = request.json
    requester_id  = data.get('requester_id')
    target_module = data.get('target_module')

    if not requester_id or not target_module:
        return jsonify({"message": "Missing requester_id or target_module"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            INSERT INTO export_requests (requester_id, target_module, status)
            VALUES (%s, %s, 'pending')
            RETURNING request_id
        """, (requester_id, target_module))
        conn.commit()
        result = cur.fetchone()
        return jsonify({"status": "success", "request_id": result['request_id']}), 201
    finally:
        cur.close()
        conn.close()


@export_requests_bp.route('/api/export-requests/pending', methods=['GET'])
def get_pending_requests():
    """Returns pending requests targeting the calling Head's module."""
    target_module = request.args.get('module')
    if not target_module:
        return jsonify({"message": "Missing module param"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT er.request_id, er.requester_id, er.target_module, er.status, er.created_at,
                   e.employee_id, r.role_name
            FROM export_requests er
            JOIN employee e ON er.requester_id = e.employee_id
            JOIN employee_role r ON e.role_id = r.role_id
            WHERE er.target_module = %s AND er.status = 'pending'
            ORDER BY er.created_at DESC
        """, (target_module,))
        return jsonify(cur.fetchall()), 200
    finally:
        cur.close()
        conn.close()


@export_requests_bp.route('/api/export-requests/<int:request_id>/approve', methods=['PUT'])
def approve_request(request_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE export_requests SET status = 'approved', resolved_at = NOW()
            WHERE request_id = %s
        """, (request_id,))
        conn.commit()
        return jsonify({"status": "success", "message": "Request approved"}), 200
    finally:
        cur.close()
        conn.close()


@export_requests_bp.route('/api/export-requests/<int:request_id>/deny', methods=['PUT'])
def deny_request(request_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE export_requests SET status = 'denied', resolved_at = NOW()
            WHERE request_id = %s
        """, (request_id,))
        conn.commit()
        return jsonify({"status": "success", "message": "Request denied"}), 200
    finally:
        cur.close()
        conn.close()
