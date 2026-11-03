
from pathlib import Path
import json

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)


# المسار الرئيسي لفولدر backend
BASE_DIR = Path(__file__).resolve().parents[1]

# ملف بيانات التدريب
DATASET_PATH = BASE_DIR / "data" / "sales_dataset.csv"

# حفظ الموديل في المكان الذي يتوقعه main.py الحالي
MODEL_PATH = BASE_DIR / "model.joblib"

# ملف نتائج تقييم الموديل
METRICS_PATH = BASE_DIR / "ml" / "metrics.json"


def main():
    # 1. التأكد من وجود بيانات التدريب
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    # 2. قراءة البيانات
    df = pd.read_csv(
        DATASET_PATH,
        encoding="utf-8-sig"
    )

    # 3. تحديد الأعمدة التي سيتعلم منها الموديل
    feature_columns = [
        "item_id",
        "category",
        "price_egp",
        "day_of_week",
        "month",
        "is_weekend",
        "promotion"
    ]

    target_column = "sold_quantity"

    # 4. التأكد من وجود الأعمدة المطلوبة
    required_columns = feature_columns + [target_column]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing columns: {missing_columns}"
        )

    # 5. فصل المدخلات عن الإجابة التي سيتعلم توقعها
    X = df[feature_columns]
    y = df[target_column]

    # 6. تجهيز الأعمدة النصية والرقمية
    categorical_columns = ["category"]

    numeric_columns = [
        "item_id",
        "price_egp",
        "day_of_week",
        "month",
        "is_weekend",
        "promotion"
    ]

    preprocessing = ColumnTransformer(
        transformers=[
            (
                "category",
                Pipeline(steps=[
                    (
                        "imputer",
                        SimpleImputer(
                            strategy="most_frequent"
                        )
                    ),
                    (
                        "encoder",
                        OneHotEncoder(
                            handle_unknown="ignore"
                        )
                    )
                ]),
                categorical_columns
            ),
            (
                "numeric",
                Pipeline(steps=[
                    (
                        "imputer",
                        SimpleImputer(
                            strategy="median"
                        )
                    )
                ]),
                numeric_columns
            )
        ]
    )

    # 7. إنشاء نموذج Machine Learning
    model = Pipeline(steps=[
        ("preprocessing", preprocessing),
        (
            "regressor",
            RandomForestRegressor(
                n_estimators=100,
                random_state=42,
                min_samples_leaf=2,
                n_jobs=-1
            )
        )
    ])

    # 8. تقسيم البيانات إلى تدريب واختبار
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42
    )

    # 9. تدريب الموديل
    print("Training the Machine Learning model...")

    model.fit(X_train, y_train)

    # 10. اختبار الموديل على بيانات لم يتدرب عليها
    predictions = model.predict(X_test)

    # 11. حساب مقاييس التقييم
    mae = mean_absolute_error(
        y_test,
        predictions
    )

    rmse = mean_squared_error(
        y_test,
        predictions
    ) ** 0.5

    r2 = r2_score(
        y_test,
        predictions
    )

    metrics = {
        "data_type": "synthetic_demo_data",
        "total_rows": int(len(df)),
        "training_rows": int(len(X_train)),
        "testing_rows": int(len(X_test)),
        "mae": round(float(mae), 3),
        "rmse": round(float(rmse), 3),
        "r2": round(float(r2), 3)
    }

    # 12. حفظ الموديل ونتائج التقييم
    joblib.dump(model, MODEL_PATH)

    METRICS_PATH.write_text(
        json.dumps(
            metrics,
            ensure_ascii=False,
            indent=4
        ),
        encoding="utf-8"
    )

    print("\nTraining completed successfully!")
    print(f"Model saved at: {MODEL_PATH}")
    print(f"Metrics saved at: {METRICS_PATH}")

    print("\nModel evaluation:")
    print(f"MAE:  {mae:.3f}")
    print(f"RMSE: {rmse:.3f}")
    print(f"R2:   {r2:.3f}")

    print(
        "\nIMPORTANT: The model was trained on synthetic "
        "demonstration data, not real restaurant sales."
    )


if __name__ == "__main__":
    main()
