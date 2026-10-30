import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

app = Flask(__name__)
CORS(app)

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],
)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/products")
def list_products():
    result = (
        supabase.table("products")
        .select("*")
        .eq("is_available", True)
        .order("created_at", desc=True)
        .execute()
    )
    return jsonify(result.data)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
