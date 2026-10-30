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



# ---------- Orders ----------

@app.post("/api/orders")
@login_required(roles=["consumer"])
def place_order():
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    address = (data.get("delivery_address") or request.profile.get("address") or "").strip()
    payment_method = data.get("payment_method")

    if not items:
        return error("Your cart is empty")
    if not address:
        return error("Delivery address is required")
    if payment_method not in ("cod", "online"):
        return error("Payment method must be 'cod' or 'online'")

    # Combine repeated products and validate quantities
    wanted = {}
    for item in items:
        pid = item.get("product_id")
        try:
            qty = float(item.get("quantity", 0))
        except (TypeError, ValueError):
            return error("Invalid quantity")
        if not pid or qty <= 0:
            return error("Each item needs a product_id and a quantity above 0")
        wanted[pid] = wanted.get(pid, 0) + qty

    try:
        found = supabase.table("products").select("*").in_("id", list(wanted)).execute().data
    except Exception:
        return error("Invalid product in cart")
    by_id = {p["id"]: p for p in found}

    # Check stock and calculate the total from database prices
    total = 0
    lines = []
    for pid, qty in wanted.items():
        p = by_id.get(pid)
        if not p or not p["is_available"]:
            return error("A product in your cart is no longer available")
        if qty > float(p["quantity"]):
            return error(f"Only {p['quantity']} {p['unit']} of {p['name']} left")
        total += float(p["price"]) * qty
        lines.append((p, qty))

    order = supabase.table("orders").insert({
        "consumer_id": request.profile["id"],
        "total_amount": round(total, 2),
        "delivery_address": address,
        "payment_method": payment_method,
        # Online payment is simulated for this project
        "payment_status": "paid" if payment_method == "online" else "pending",
    }).execute().data[0]

    try:
        supabase.table("order_items").insert([
            {
                "order_id": order["id"],
                "product_id": p["id"],
                "farmer_id": p["farmer_id"],
                "quantity": qty,
                "unit_price": p["price"],
            }
            for p, qty in lines
        ]).execute()
        for p, qty in lines:
            left = float(p["quantity"]) - qty
            supabase.table("products").update(
                {"quantity": left, "is_available": left > 0}
            ).eq("id", p["id"]).execute()
    except Exception as e:
        supabase.table("orders").delete().eq("id", order["id"]).execute()
        return error(f"Could not place order: {e}", 500)

    return jsonify(order), 201


@app.get("/api/orders")
@login_required(roles=["consumer"])
def my_orders():
    result = (
        supabase.table("orders")
        .select("*, order_items(*, products(name, unit))")
        .eq("consumer_id", request.profile["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return jsonify(result.data)


@app.put("/api/orders/<order_id>/cancel")
@login_required(roles=["consumer"])
def cancel_order(order_id):
    rows = (
        supabase.table("orders").select("*")
        .eq("id", order_id).eq("consumer_id", request.profile["id"])
        .execute().data
    )
    if not rows:
        return error("Order not found", 404)
    if rows[0]["status"] != "placed":
        return error("Only orders that are not yet accepted can be cancelled")

    # Put the stock back
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute().data
    for it in items:
        prod = supabase.table("products").select("quantity").eq("id", it["product_id"]).execute().data
        if prod:
            supabase.table("products").update({
                "quantity": float(prod[0]["quantity"]) + float(it["quantity"]),
                "is_available": True,
            }).eq("id", it["product_id"]).execute()

    supabase.table("orders").update({"status": "cancelled"}).eq("id", order_id).execute()
    return jsonify({"message": "Order cancelled"})


@app.get("/api/farmer/orders")
@login_required(roles=["farmer"])
def farmer_orders():
    result = (
        supabase.table("order_items")
        .select("*, products(name, unit), "
                "orders(id, status, payment_method, payment_status, delivery_address, created_at, "
                "profiles(full_name, phone))")
        .eq("farmer_id", request.profile["id"])
        .execute()
    )
    return jsonify(result.data)


@app.put("/api/orders/<order_id>/status")
@login_required(roles=["farmer"])
def update_order_status(order_id):
    new_status = (request.get_json(silent=True) or {}).get("status")
    if new_status not in ("accepted", "shipped", "delivered"):
        return error("Status must be accepted, shipped or delivered")

    mine = (
        supabase.table("order_items").select("id")
        .eq("order_id", order_id).eq("farmer_id", request.profile["id"])
        .execute().data
    )
    if not mine:
        return error("Order not found", 404)

    current = supabase.table("orders").select("status").eq("id", order_id).execute().data[0]
    if current["status"] in ("cancelled", "delivered"):
        return error(f"This order is already {current['status']}")

    changes = {"status": new_status}
    if new_status == "delivered":
        changes["payment_status"] = "paid"   # cash collected on delivery
    updated = supabase.table("orders").update(changes).eq("id", order_id).execute()
    return jsonify(updated.data[0])


# ---------- Reviews ----------

@app.get("/api/products/<product_id>/reviews")
def product_reviews(product_id):
    result = (
        supabase.table("reviews")
        .select("*, profiles(full_name)")
        .eq("product_id", product_id)
        .order("created_at", desc=True)
        .execute()
    )
    return jsonify(result.data)


@app.post("/api/products/<product_id>/reviews")
@login_required(roles=["consumer"])
def add_review(product_id):
    data = request.get_json(silent=True) or {}
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return error("Rating must be a number from 1 to 5")
    if not 1 <= rating <= 5:
        return error("Rating must be a number from 1 to 5")

    # Only people who received this product can review it
    bought = (
        supabase.table("order_items")
        .select("id, orders!inner(status, consumer_id)")
        .eq("product_id", product_id)
        .eq("orders.consumer_id", request.profile["id"])
        .eq("orders.status", "delivered")
        .execute().data
    )
    if not bought:
        return error("You can review a product only after it is delivered", 403)

    result = supabase.table("reviews").upsert({
        "product_id": product_id,
        "consumer_id": request.profile["id"],
        "rating": rating,
        "comment": data.get("comment"),
    }, on_conflict="product_id,consumer_id").execute()
    return jsonify(result.data[0]), 201


if __name__ == "__main__":
    app.run(debug=True, port=5001)
