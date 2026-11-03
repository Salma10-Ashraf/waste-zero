
import csv
import sqlite3
from pathlib import Path
from datetime import datetime

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ==========================================
# 1. Create FastAPI application
# ==========================================

app = FastAPI(
    title="WasteZero API - Lokma w Lakima",
    description="Restaurant menu, demand prediction and waste management.",
    version="2.2"
)


# ==========================================
# 2. Configure CORS for Angular
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# 3. File paths
# ==========================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

MENU_PATH = DATA_DIR / "menu.csv"
MENU_FILE = MENU_PATH
MODEL_PATH = BASE_DIR / "model.joblib"
DB_PATH = DATA_DIR / "wastezero.db"


# ==========================================
# 4. Load menu and trained model
# ==========================================

def load_menu():
    if not MENU_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail="Menu file was not found."
        )

    try:
        menu = pd.read_csv(MENU_PATH, encoding="utf-8-sig")
    except Exception as exc:
        print("Menu loading error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not read the menu file."
        )

    required_columns = {
        "item_id", "name", "category", "price_egp"
    }

    if not required_columns.issubset(menu.columns):
        raise HTTPException(
            status_code=500,
            detail="Menu CSV is missing required columns."
        )

    return menu


def load_model():
    if not MODEL_PATH.exists():
        return None

    try:
        return joblib.load(MODEL_PATH)
    except Exception as exc:
        print("Model loading error:", repr(exc))
        return None


model = load_model()


# ==========================================
# 5. Database and prediction history
# ==========================================

def ensure_history_table():
    """
    Create the prediction history table if needed.
    Add missing columns when an older database already exists.
    Existing history records are preserved.
    """

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_type TEXT NOT NULL DEFAULT 'waste',
                item_id INTEGER,
                item_name TEXT,
                predicted_demand INTEGER,
                prepared_quantity INTEGER,
                sold_quantity INTEGER,
                predicted_waste INTEGER DEFAULT 0,
                loss_cost REAL DEFAULT 0,
                recommendation TEXT,
                created_at TEXT NOT NULL DEFAULT ''
            )
        """)

        existing_columns = {
            row[1]
            for row in conn.execute(
                "PRAGMA table_info(prediction_history)"
            ).fetchall()
        }

        required_columns = {
            "prediction_type": "TEXT NOT NULL DEFAULT 'waste'",
            "item_id": "INTEGER",
            "item_name": "TEXT",
            "predicted_demand": "INTEGER",
            "prepared_quantity": "INTEGER",
            "sold_quantity": "INTEGER",
            "predicted_waste": "INTEGER DEFAULT 0",
            "loss_cost": "REAL DEFAULT 0",
            "recommendation": "TEXT",
            "created_at": "TEXT NOT NULL DEFAULT ''"
        }

        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                conn.execute(
                    f"ALTER TABLE prediction_history "
                    f"ADD COLUMN {column_name} {column_type}"
                )

        conn.commit()



def save_prediction_history(
    prediction_type,
    item_id=None,
    item_name=None,
    predicted_demand=None,
    prepared_quantity=None,
    sold_quantity=None,
    predicted_waste=None,
    loss_cost=None,
    recommendation=None,
    potential_excess_quantity=None,
    potential_shortage_quantity=None
):

    ensure_history_table()

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        # Read the existing database table structure
        cursor.execute("PRAGMA table_info(prediction_history)")
        table_info = cursor.fetchall()

        existing_columns = {column[1] for column in table_info}

        # Prepare values for the existing database columns
        values = {
            "prediction_type": prediction_type,
            "item_id": item_id,
            "item_name": item_name,
            "predicted_demand": predicted_demand,
            "prepared_quantity": prepared_quantity,
            "sold_quantity": sold_quantity,
            "predicted_waste": predicted_waste,
            "potential_excess_quantity": (
                potential_excess_quantity
                if potential_excess_quantity is not None
                else (predicted_waste if predicted_waste is not None else 0)
            ),
            "potential_shortage_quantity": (
                potential_shortage_quantity
                if potential_shortage_quantity is not None
                else 0
            ),
            "loss_cost": loss_cost if loss_cost is not None else 0,
            "recommendation": recommendation,
            "created_at": datetime.now().isoformat(timespec="seconds")
        }

        # Keep only columns that exist in this database
        insert_values = {
            column: value
            for column, value in values.items()
            if column in existing_columns
        }

        # Check for other required columns without defaults
        missing_required = [
            column[1]
            for column in table_info
            if column[3] == 1
            and column[4] is None
            and column[5] == 0
            and column[1] not in insert_values
            and column[1] != "id"
        ]

        if missing_required:
            raise RuntimeError(
                "Missing required database columns: "
                + ", ".join(missing_required)
            )

        columns_sql = ", ".join(
            '"' + column + '"'
            for column in insert_values
        )
        placeholders = ", ".join(
            ["?"] * len(insert_values)
        )

        cursor.execute(
            f"""
            INSERT INTO prediction_history ({columns_sql})
            VALUES ({placeholders})
            """,
            list(insert_values.values())
        )

        conn.commit()


# Create or migrate the database table when the API starts.
ensure_history_table()


# ==========================================
# 6. Request models
# ==========================================

class PredictionRequest(BaseModel):
    price: float = Field(..., gt=0)
    prepared_quantity: int = Field(..., ge=0)
    sold_quantity: int = Field(..., ge=0)


class DemandPredictionRequest(BaseModel):
    item_id: int = Field(..., ge=1)
    day_of_week: int = Field(..., ge=0, le=6)
    month: int = Field(..., ge=1, le=12)
    prepared_quantity: int = Field(..., ge=0)
    promotion: bool = False


class MenuItemCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    category: str = Field(min_length=2, max_length=50)
    price_egp: float = Field(..., gt=0)


# ==========================================
# 7. Home and health endpoints
# ==========================================

@app.get("/")
def home():
    return {
        "message": "WasteZero API is running successfully!",
        "status": "success",
        "model_ready": model is not None,
        "training_data": "Synthetic demonstration data"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_ready": model is not None
    }


# ==========================================
# 8. Menu endpoints
# ==========================================

@app.get("/api/menu")
def get_menu():
    menu = load_menu()

    return menu.where(
        pd.notna(menu),
        None
    ).to_dict(orient="records")


def read_menu_file():
    if not MENU_FILE.exists():
        raise HTTPException(
            status_code=500,
            detail="Menu file not found."
        )

    try:
        with open(
            MENU_FILE,
            "r",
            encoding="utf-8-sig",
            newline=""
        ) as file:
            return list(csv.DictReader(file))
    except Exception as exc:
        print("Menu CSV read error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not read the menu file."
        )


def write_menu_file(items):
    MENU_FILE.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(
            MENU_FILE,
            "w",
            encoding="utf-8-sig",
            newline=""
        ) as file:
            writer = csv.DictWriter(
                file,
                fieldnames=[
                    "item_id",
                    "name",
                    "category",
                    "price_egp"
                ]
            )
            writer.writeheader()
            writer.writerows(items)
    except Exception as exc:
        print("Menu CSV write error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not save the menu file."
        )


@app.post("/api/menu")
def add_menu_item(item: MenuItemCreate):
    items = read_menu_file()

    new_id = max(
        (int(row["item_id"]) for row in items),
        default=0
    ) + 1

    new_item = {
        "item_id": new_id,
        "name": item.name.strip(),
        "category": item.category.strip(),
        "price_egp": item.price_egp
    }

    if len(new_item["name"]) < 2 or len(new_item["category"]) < 2:
        raise HTTPException(
            status_code=422,
            detail="Name and category must contain at least 2 characters."
        )

    items.append(new_item)
    write_menu_file(items)

    return {
        "message": "Menu item added successfully.",
        "item": new_item,
        "note": (
            "Retrain or update the ML model before relying on predictions "
            "for this new item."
        )
    }


@app.put("/api/menu/{item_id}")
def update_menu_item(item_id: int, item: MenuItemCreate):
    items = read_menu_file()

    for row in items:
        if int(row["item_id"]) == item_id:
            row["name"] = item.name.strip()
            row["category"] = item.category.strip()
            row["price_egp"] = item.price_egp

            if len(row["name"]) < 2 or len(row["category"]) < 2:
                raise HTTPException(
                    status_code=422,
                    detail="Name and category must contain at least 2 characters."
                )

            write_menu_file(items)

            return {
                "message": "Menu item updated successfully.",
                "item": {
                    "item_id": int(row["item_id"]),
                    "name": row["name"],
                    "category": row["category"],
                    "price_egp": float(row["price_egp"])
                }
            }

    raise HTTPException(
        status_code=404,
        detail="Menu item not found."
    )


@app.delete("/api/menu/{item_id}")
def delete_menu_item(item_id: int):
    items = read_menu_file()

    updated_items = [
        row for row in items
        if int(row["item_id"]) != item_id
    ]

    if len(updated_items) == len(items):
        raise HTTPException(
            status_code=404,
            detail="Menu item not found."
        )

    write_menu_file(updated_items)

    return {
        "message": "Menu item deleted successfully."
    }


# ==========================================
# 9. Machine Learning demand prediction
# ==========================================


@app.post("/api/predict-demand")
def predict_demand(data: DemandPredictionRequest):
    import traceback

    # 1. Check whether the model is loaded
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not available. Train the model first."
        )

    try:
        # 2. Load the restaurant menu
        menu = load_menu()

        if menu is None or menu.empty:
            raise HTTPException(
                status_code=500,
                detail="The menu is empty or could not be loaded."
            )

        # 3. Find the selected menu item
        item_rows = menu[
            menu["item_id"].astype(int) == int(data.item_id)
        ]

        if item_rows.empty:
            raise HTTPException(
                status_code=404,
                detail="Item was not found in the menu."
            )

        item = item_rows.iloc[0]

        # 4. Validate the input values
        if not 0 <= data.day_of_week <= 6:
            raise HTTPException(
                status_code=422,
                detail="day_of_week must be between 0 and 6."
            )

        if not 1 <= data.month <= 12:
            raise HTTPException(
                status_code=422,
                detail="month must be between 1 and 12."
            )

        if data.prepared_quantity < 0:
            raise HTTPException(
                status_code=422,
                detail="prepared_quantity cannot be negative."
            )

        # 5. Prepare the model input
        features = pd.DataFrame([{
            "item_id": int(item["item_id"]),
            "category": str(item["category"]),
            "price_egp": float(item["price_egp"]),
            "day_of_week": int(data.day_of_week),
            "month": int(data.month),
            "is_weekend": int(data.day_of_week in [4, 5]),
            "promotion": int(data.promotion)
        }])

        print("DEBUG: Model type:", type(model).__name__)
        print("DEBUG: Prediction features:", features.to_dict(orient="records"))

        # 6. Generate the prediction
        try:
            predicted_values = model.predict(features)

            print("DEBUG: Raw prediction:", predicted_values)

            predicted_demand = max(
                0,
                int(round(float(predicted_values[0])))
            )

        except Exception as exc:
            traceback.print_exc()

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Prediction failed: "
                    f"{type(exc).__name__}: {exc}"
                )
            ) from exc

        # 7. Calculate possible excess and shortage
        prepared_quantity = int(data.prepared_quantity)

        potential_excess = max(
            0,
            prepared_quantity - predicted_demand
        )

        shortage = max(
            0,
            predicted_demand - prepared_quantity
        )

        # 8. Generate a recommendation
        if prepared_quantity == 0:
            recommendation = (
                "أدخلي كمية التحضير المخططة لمعرفة الفائض المحتمل."
            )
        elif potential_excess >= 3:
            recommendation = (
                "كمية التحضير أعلى من الطلب المتوقع. "
                "راجعي إمكانية تقليل الكمية."
            )
        elif shortage > 0:
            recommendation = (
                "الطلب المتوقع أعلى من كمية التحضير. "
                "راجعي إمكانية زيادة الكمية."
            )
        else:
            recommendation = (
                "كمية التحضير قريبة من الطلب المتوقع."
            )

        # 9. Save the prediction to the database
        try:
            
                    save_prediction_history(
                        prediction_type="demand",
                        item_id=int(item["item_id"]),
                        item_name=str(item["name"]),
                        predicted_demand=predicted_demand,
                        prepared_quantity=prepared_quantity,
                        predicted_waste=0,
                        potential_excess_quantity=potential_excess,
                        potential_shortage_quantity=shortage,
                        recommendation=recommendation
                    ) 
        except Exception as exc:
            traceback.print_exc()

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Saving prediction failed: "
                    f"{type(exc).__name__}: {exc}"
                )
            ) from exc

        # 10. Return the result to Angular
        return {
            "item_id": int(item["item_id"]),
            "item_name": str(item["name"]),
            "predicted_demand": predicted_demand,
            "prepared_quantity": prepared_quantity,
            "potential_excess_quantity": potential_excess,
            "potential_shortage_quantity": shortage,
            "recommendation": recommendation,
            "data_note": (
                "توقع تجريبي مبني على بيانات اصطناعية، "
                "وليس على مبيعات المطعم الحقيقية."
            )
        }

    except HTTPException:
        raise

    except Exception as exc:
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"Demand prediction failed: {type(exc).__name__}: {exc}"
        ) from exc

# ==========================================
# 11. Prediction history endpoint
# ==========================================

@app.get("/api/prediction-history")
def get_prediction_history(
    limit: int = Query(default=100, ge=1, le=500)
):
    ensure_history_table()

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT *
            FROM prediction_history
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    return [dict(row) for row in rows]


# ==========================================
# 12. Analytics summary endpoint
# ==========================================
@app.get("/api/analytics/summary")
def get_analytics_summary():
    try:
        ensure_history_table()

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row

            # Overall analytics summary
            row = conn.execute("""
                SELECT
                    COUNT(*) AS total_predictions,
COALESCE(
    SUM(
        CASE
            WHEN prediction_type = 'waste' THEN predicted_waste
            ELSE 0
        END
    ),
    0
) AS total_waste,
                    COALESCE(SUM(loss_cost), 0) AS total_loss_cost,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN prediction_type = 'demand' THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS demand_predictions
                FROM prediction_history
            """).fetchone()

            # Aggregate potential surplus by menu item
            surplus_rows = conn.execute("""
                SELECT
                    item_id,
                    item_name,
                    COUNT(*) AS prediction_count,
                    COALESCE(SUM(potential_excess_quantity), 0)
                        AS potential_excess_quantity
                FROM prediction_history
                WHERE item_name IS NOT NULL
                  AND TRIM(item_name) != ''
                GROUP BY item_id, item_name
                ORDER BY potential_excess_quantity DESC
            """).fetchall()

        return {
            "total_predictions": row["total_predictions"],
            "total_waste": row["total_waste"],
            "total_loss_cost": round(float(row["total_loss_cost"]), 2),
            "demand_predictions": row["demand_predictions"],
            "surplus_by_item": [
                {
                    "item_id": item["item_id"],
                    "item_name": item["item_name"],
                    "prediction_count": item["prediction_count"],
                    "potential_excess_quantity": item[
                        "potential_excess_quantity"
                    ]
                }
                for item in surplus_rows
            ]
        }

    except Exception as exc:
        print("Analytics summary error:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=f"Analytics summary failed: {str(exc)}"
        )
