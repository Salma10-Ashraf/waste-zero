
from pathlib import Path

import numpy as np
import pandas as pd

# مسار فولدر backend
BASE_DIR = Path(__file__).resolve().parents[1]

# ملف المنيو الموجود عندنا
MENU_PATH = BASE_DIR / "data" / "menu.csv"

# مكان حفظ بيانات التدريب
OUTPUT_PATH = BASE_DIR / "data" / "sales_dataset.csv"


def main():
    if not MENU_PATH.exists():
        raise FileNotFoundError(
            f"Menu file not found: {MENU_PATH}"
        )

    # قراءة المنيو مع الحفاظ على العربية
    menu = pd.read_csv(
        MENU_PATH,
        encoding="utf-8-sig"
    )

    required_columns = {
        "item_id",
        "name",
        "category",
        "price_egp"
    }

    if not required_columns.issubset(menu.columns):
        raise ValueError(
            "Menu columns must include: "
            "item_id, name, category, price_egp"
        )

    menu["price_egp"] = pd.to_numeric(
        menu["price_egp"],
        errors="coerce"
    )

    menu = menu.dropna(
        subset=["item_id", "name", "category", "price_egp"]
    )

    rng = np.random.default_rng(42)
    records = []

    # 180 يومًا من البيانات التجريبية
    start_date = pd.Timestamp("2025-01-01")

    for day_number in range(180):
        date = start_date + pd.Timedelta(days=day_number)

        day_of_week = date.dayofweek
        month = date.month

        # افتراض تجريبي: الخميس والجمعة أعلى طلبًا
        is_weekend = int(day_of_week in [3, 4])

        for _, item in menu.iterrows():
            name = str(item["name"])
            category = str(item["category"])
            price = float(item["price_egp"])

            # افتراضات تجريبية وليست مبيعات حقيقية
            popularity = 1.0

            if any(word in name for word in [
                "فول", "طعمية", "بيض", "بطاطس"
            ]):
                popularity *= 1.35

            if any(word in name for word in [
                "شاورما", "برجر", "كريب", "فرايد"
            ]):
                popularity *= 1.15

            price_factor = max(
                0.35,
                min(1.4, 30 / max(price, 1))
            )

            weekend_factor = (
                1.2 if is_weekend else 1.0
            )

            promotion = int(rng.random() < 0.12)
            promotion_factor = (
                1.25 if promotion else 1.0
            )

            seasonal_factor = (
                1 + 0.1 * np.sin(month * 2 * np.pi / 12)
            )

            expected_sales = (
                5
                * popularity
                * price_factor
                * weekend_factor
                * promotion_factor
                * seasonal_factor
            )

            sold_quantity = max(
                0,
                int(round(
                    rng.normal(
                        expected_sales,
                        max(1, expected_sales * 0.2)
                    )
                ))
            )

            # كمية التحضير التجريبية
            prepared_quantity = sold_quantity + int(
                rng.integers(0, 5)
            )

            leftover_quantity = max(
                0,
                prepared_quantity - sold_quantity
            )

            # للتجربة نفترض أن المتبقي كله هدر.
            # في الواقع لازم نسجل الهدر الفعلي منفصلًا.
            records.append({
                "date": date.strftime("%Y-%m-%d"),
                "item_id": int(item["item_id"]),
                "item_name": name,
                "category": category,
                "price_egp": price,
                "day_of_week": day_of_week,
                "month": month,
                "is_weekend": is_weekend,
                "promotion": promotion,
                "prepared_quantity": prepared_quantity,
                "sold_quantity": sold_quantity,
                "leftover_quantity": leftover_quantity,
                "actual_waste_quantity": leftover_quantity,
                "data_type": "synthetic_demo_data"
            })

    dataset = pd.DataFrame(records)

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    dataset.to_csv(
        OUTPUT_PATH,
        index=False,
        encoding="utf-8-sig"
    )

    print("Synthetic dataset created successfully.")
    print(f"Output: {OUTPUT_PATH}")
    print(f"Rows: {len(dataset)}")
    print(f"Menu items: {menu['item_id'].nunique()}")
    print(
        "Data type: synthetic demo data, not real sales."
    )


if __name__ == "__main__":
    main()
