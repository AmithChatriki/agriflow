import os
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

app = Flask(__name__)
CORS(app)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------- Helpers ----------

def error(message, status=400):
    return jsonify({"error": message}), status


def login_required(roles=None):
    """Checks the login token and (optionally) the user's role."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return error("Please log in first", 401)
            token = header.split(" ", 1)[1]

            try:
                user = supabase.auth.get_user(token).user
            except Exception:
                return error("Invalid or expired login", 401)
            if user is None:
                return error("Invalid or expired login", 401)

            profile = (
                supabase.table("profiles")
                .select("*")
                .eq("id", user.id)
                .execute()
                .data
            )
            if not profile:
                return error("Profile not found", 404)
            profile = profile[0]

            if roles and profile["role"] not in roles:
                return error("You are not allowed to do this", 403)

            request.profile = profile
            return f(*args, **kwargs)
        return wrapper
    return decorator


# ---------- Basic ----------

@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# ---------- Auth ----------

@app.post("/api/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    role = data.get("role")

    if not email or not full_name:
        return error("Email and full name are required")
    if len(password) < 6:
        return error("Password must be at least 6 characters")
    if role not in ("farmer", "consumer"):
        return error("Role must be 'farmer' or 'consumer'")

    try:
        created = supabase.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        )
    except Exception as e:
        return error(f"Could not create account: {e}")

    user_id = created.user.id
    try:
        supabase.table("profiles").insert({
            "id": user_id,
            "full_name": full_name,
            "phone": data.get("phone"),
            "address": data.get("address"),
            "role": role,
        }).execute()
    except Exception as e:
        # Undo the login account if the profile could not be saved
        supabase.auth.admin.delete_user(user_id)
        return error(f"Could not save profile: {e}")

    return jsonify({"message": "Account created. Please log in."}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # Separate client so the main one stays unaffected by user sessions
    temp_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        result = temp_client.auth.sign_in_with_password(
            {"email": email, "password": password}
        )
    except Exception:
        return error("Wrong email or password", 401)

    profile = (
        supabase.table("profiles")
        .select("*")
        .eq("id", result.user.id)
        .execute()
        .data
    )
    return jsonify({
        "access_token": result.session.access_token,
        "profile": profile[0] if profile else None,
    })


@app.get("/api/me")
@login_required()
def me():
    return jsonify(request.profile)


# ---------- Products ----------

PRODUCT_FIELDS = ["name", "category", "description", "price",
                  "unit", "quantity", "image_url", "is_available"]


@app.get("/api/products")
def list_products():
    query = supabase.table("products").select("*, profiles(full_name, address)")
    query = query.eq("is_available", True)

    category = request.args.get("category")
    search = request.args.get("search")
    if category:
        query = query.eq("category", category)
    if search:
        query = query.ilike("name", f"%{search}%")

    result = query.order("created_at", desc=True).execute()
    return jsonify(result.data)


@app.get("/api/products/<product_id>")
def get_product(product_id):
    result = (
        supabase.table("products")
        .select("*, profiles(full_name, address)")
        .eq("id", product_id)
        .execute()
    )
    if not result.data:
        return error("Product not found", 404)
    return jsonify(result.data[0])


@app.get("/api/farmer/products")
@login_required(roles=["farmer"])
def my_products():
    result = (
        supabase.table("products")
        .select("*")
        .eq("farmer_id", request.profile["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return jsonify(result.data)


@app.post("/api/products")
@login_required(roles=["farmer"])
def add_product():
    data = request.get_json(silent=True) or {}
    for field in ("name", "category", "price", "unit", "quantity"):
        if data.get(field) in (None, ""):
            return error(f"'{field}' is required")

    row = {k: data[k] for k in PRODUCT_FIELDS if k in data}
    row["farmer_id"] = request.profile["id"]

    try:
        result = supabase.table("products").insert(row).execute()
    except Exception as e:
        return error(f"Could not add product: {e}")
    return jsonify(result.data[0]), 201


@app.put("/api/products/<product_id>")
@login_required(roles=["farmer"])
def update_product(product_id):
    data = request.get_json(silent=True) or {}
    changes = {k: data[k] for k in PRODUCT_FIELDS if k in data}
    if not changes:
        return error("Nothing to update")

    try:
        result = (
            supabase.table("products")
            .update(changes)
            .eq("id", product_id)
            .eq("farmer_id", request.profile["id"])
            .execute()
        )
    except Exception as e:
        return error(f"Could not update product: {e}")
    if not result.data:
        return error("Product not found", 404)
    return jsonify(result.data[0])


@app.delete("/api/products/<product_id>")
@login_required(roles=["farmer"])
def delete_product(product_id):
    result = (
        supabase.table("products")
        .delete()
        .eq("id", product_id)
        .eq("farmer_id", request.profile["id"])
        .execute()
    )
    if not result.data:
        return error("Product not found", 404)
    return jsonify({"message": "Product deleted"})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
