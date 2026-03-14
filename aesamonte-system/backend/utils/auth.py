from functools import wraps
from flask import request, jsonify
import jwt

SECRET_KEY = "your_super_secret_key"

def require_permission(permission_key):
    """
    Decorator to check if the user's token contains the required permission.
    Example usage: @require_permission('inventory')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({"error": "Missing Authorization header"}), 401
            
            try:
                token = auth_header.split(" ")[1]
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                
                # Check the specific granular permission!
                user_permissions = payload.get('permissions', {})
                if not user_permissions.get(permission_key):
                    # They don't have access! Block the request.
                    return jsonify({"error": f"Access Denied: Lacks {permission_key} permissions"}), 403
                    
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Session expired. Please log in again."}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid authentication token."}), 401
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator