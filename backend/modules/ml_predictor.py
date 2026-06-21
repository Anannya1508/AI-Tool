import joblib
import numpy as np
import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)

class MLPredictor:
    def __init__(self, model_path=None):
        """
        Initialize with pre-trained model or empty state
        """
        self.model = None
        self.model_type = None
        
        if model_path and os.path.exists(model_path):
            try:
                self.model = joblib.load(model_path)
                self.model_type = "loaded"
            except Exception as e:
                print(f"Error loading model: {e}")
                self.model = None
                self.model_type = "failed"
        else:
            self.model_type = None

    def predict(self, input_value):
        """Make prediction"""
        if self.model is None:
            return {"error": "No model loaded. Please upload a valid .pkl model file."}
        try:
            X = np.array([[input_value]])
            prediction = self.model.predict(X)[0]
            
            return {
                "input": float(input_value),
                "prediction": float(prediction),
                "model_type": self.model_type,
                "confidence": 0.85
            }
        except Exception as e:
            return {
                "error": f"Prediction failed: {str(e)}",
                "model_type": self.model_type
            }

    def get_model_info(self):
        """Get information about loaded model"""
        expected_features = self.get_expected_features()
        if self.model is None:
            return {
                "model_type": None,
                "status": "No model loaded",
                "supported_models": ["Regression", "Classification", "Clustering"],
                "expected_features": [],
                "has_model": False
            }
        return {
            "model_type": self.model_type,
            "status": "Ready for prediction",
            "supported_models": ["Regression", "Classification", "Clustering"],
            "expected_features": expected_features,
            "has_model": True
        }

    def batch_predict(self, input_values):
        """Make batch predictions"""
        if self.model is None:
            return {"error": "No model loaded. Please upload a valid .pkl model file."}
        try:
            X = np.array(input_values).reshape(-1, 1)
            predictions = self.model.predict(X)
            
            return {
                "inputs": input_values,
                "predictions": [float(p) for p in predictions],
                "model_type": self.model_type
            }
        except Exception as e:
            return {
                "error": f"Batch prediction failed: {str(e)}"
            }

    def get_expected_features(self):
        """Return model feature names when available."""
        if self.model is None:
            return []
        try:
            if hasattr(self.model, "feature_names_in_"):
                return [str(col) for col in self.model.feature_names_in_.tolist()]
        except Exception:
            pass
        return []

    def analyze_dataset(self, dataframe, target_column=None):
        """Run prediction summary and optional evaluation on an input dataframe."""
        if self.model is None:
            return {"error": "Model failed to load. Please upload a valid .pkl model trained with scikit-learn."}
        if dataframe is None or dataframe.empty:
            return {"error": "Dataset is empty"}

        df = dataframe.copy()
        if target_column:
            target_column = target_column.strip()
            if target_column and target_column not in df.columns:
                return {"error": f"target_column '{target_column}' not found in dataset"}

        y_true = None
        if target_column:
            y_true = df[target_column]

        expected_features = self.get_expected_features()
        schema_check = {
            "expected_features": expected_features,
            "dataset_columns": [str(col) for col in df.columns.tolist()],
            "missing_features": [],
            "extra_features": [],
            "is_compatible": True,
            "compatibility_score": 1.0,
            "model_expected_feature_count": None,
            "inferred_features": [],
        }

        model_expected_feature_count = self._get_expected_feature_count()
        schema_check["model_expected_feature_count"] = model_expected_feature_count

        if expected_features:
            schema_check["missing_features"] = [f for f in expected_features if f not in df.columns]
            schema_check["extra_features"] = [
                c for c in df.columns if c not in expected_features and c != target_column
            ]
            schema_check["is_compatible"] = len(schema_check["missing_features"]) == 0
            total_expected = max(1, len(expected_features))
            matched = len(expected_features) - len(schema_check["missing_features"])
            schema_check["compatibility_score"] = round(matched / total_expected, 4)

            if not schema_check["is_compatible"]:
                return {
                    "error": "Dataset columns do not match model expected features",
                    "schema_check": schema_check,
                }

            X = df[expected_features]
            used_features = expected_features
        else:
            candidate_features = [c for c in df.columns if c != target_column]
            if not candidate_features:
                return {"error": "No usable feature columns found in dataset"}

            if model_expected_feature_count is not None:
                numeric_candidates = [
                    c for c in candidate_features if pd.api.types.is_numeric_dtype(df[c])
                ]
                selection_pool = (
                    numeric_candidates
                    if len(numeric_candidates) >= model_expected_feature_count
                    else candidate_features
                )
                selection_pool = self._rank_inferred_features(selection_pool)

                if len(selection_pool) < model_expected_feature_count:
                    return {
                        "error": (
                            f"Model expects {model_expected_feature_count} features, "
                            f"but dataset provides only {len(selection_pool)} usable columns"
                        ),
                        "schema_check": schema_check,
                    }

                used_features = selection_pool[:model_expected_feature_count]
                schema_check["inferred_features"] = [str(c) for c in used_features]
            else:
                used_features = candidate_features

            X = df[used_features]

        try:
            predictions = self.model.predict(X)
        except Exception as e:
            return {"error": f"Model prediction failed: {str(e)}", "schema_check": schema_check}

        prediction_summary = self._build_prediction_summary(predictions)
        evaluation = None

        if target_column and y_true is not None:
            evaluation = self._evaluate_predictions(y_true, predictions)

        feature_importance = self._get_feature_importance(used_features)
        prediction_preview = self._build_prediction_preview(
            df=df,
            predictions=predictions,
            target_column=target_column,
            used_features=used_features,
        )
        risk_alerts = self._build_risk_alerts(
            prediction_preview=prediction_preview,
            schema_check=schema_check,
            evaluation=evaluation,
        )
        topic_alignment = self._assess_topic_alignment(
            schema_check=schema_check,
            used_features=used_features,
            evaluation=evaluation,
        )
        popup_insight = self._build_popup_insight(
            topic_alignment=topic_alignment,
            schema_check=schema_check,
            evaluation=evaluation,
            risk_alerts=risk_alerts,
        )

        return {
            "model_type": self.model_type,
            "used_features": used_features,
            "target_column": target_column,
            "schema_check": schema_check,
            "prediction_summary": prediction_summary,
            "evaluation": evaluation,
            "feature_importance": feature_importance,
            "prediction_preview": prediction_preview,
            "risk_alerts": risk_alerts,
            "topic_alignment": topic_alignment,
            "popup_insight": popup_insight,
        }

    def _build_prediction_summary(self, predictions):
        """Build JSON-safe summary for prediction output."""
        pred_array = np.array(predictions)
        flat_preds = pred_array.reshape(-1)

        summary = {
            "count": int(len(flat_preds)),
            "sample_predictions": [self._to_json_safe(v) for v in flat_preds[:10]],
        }

        if len(flat_preds) == 0:
            return summary

        if np.issubdtype(flat_preds.dtype, np.number):
            summary.update({
                "min": float(np.min(flat_preds)),
                "max": float(np.max(flat_preds)),
                "mean": float(np.mean(flat_preds)),
                "std": float(np.std(flat_preds)),
            })
        else:
            values, counts = np.unique(flat_preds, return_counts=True)
            summary.update({
                "class_distribution": {
                    str(k): int(v) for k, v in zip(values.tolist(), counts.tolist())
                }
            })

        return summary

    def _evaluate_predictions(self, y_true, y_pred):
        """Evaluate predictions as regression or classification."""
        y_true_series = pd.Series(y_true)
        y_pred_series = pd.Series(np.array(y_pred).reshape(-1))

        if len(y_true_series) != len(y_pred_series):
            return {"error": "Target size does not match prediction size"}

        try:
            y_true_num = pd.to_numeric(y_true_series, errors="coerce")
            y_pred_num = pd.to_numeric(y_pred_series, errors="coerce")
            numeric_ratio = float(y_true_num.notna().mean()) if len(y_true_num) else 0.0
            numeric_complete = y_true_num.notna().all() and y_pred_num.notna().all()
            unique_count = int(y_true_series.nunique(dropna=True))

            is_probably_classification = (
                y_true_series.dtype == "object"
                or y_true_series.dtype == "bool"
                or (numeric_ratio < 1.0)
                or (numeric_complete and unique_count <= 10)
            )

            if not is_probably_classification and numeric_complete:
                rmse = float(np.sqrt(mean_squared_error(y_true_num, y_pred_num)))
                return {
                    "task_type": "regression",
                    "mae": float(mean_absolute_error(y_true_num, y_pred_num)),
                    "rmse": rmse,
                    "r2": float(r2_score(y_true_num, y_pred_num)),
                }

            y_true_cls = y_true_series.astype(str)
            y_pred_cls = y_pred_series.astype(str)
            return {
                "task_type": "classification",
                "accuracy": float(accuracy_score(y_true_cls, y_pred_cls)),
                "precision_weighted": float(
                    precision_score(y_true_cls, y_pred_cls, average="weighted", zero_division=0)
                ),
                "recall_weighted": float(
                    recall_score(y_true_cls, y_pred_cls, average="weighted", zero_division=0)
                ),
                "f1_weighted": float(
                    f1_score(y_true_cls, y_pred_cls, average="weighted", zero_division=0)
                ),
            }
        except Exception as e:
            return {"error": f"Evaluation failed: {str(e)}"}

    def _to_json_safe(self, value):
        """Convert numpy/pandas values to JSON-safe Python values."""
        if isinstance(value, (np.floating, float)):
            return float(value)
        if isinstance(value, (np.integer, int)):
            return int(value)
        return str(value)

    def _get_expected_feature_count(self):
        """Return model input feature count when available."""
        try:
            if hasattr(self.model, "n_features_in_"):
                return int(self.model.n_features_in_)
        except Exception:
            pass
        return None

    def _rank_inferred_features(self, feature_names):
        """Prefer high-signal feature names and avoid id/index-like columns."""
        def score(name):
            col = str(name).lower()
            value = 0
            if any(token in col for token in ["id", "index", "serial", "no"]):
                value -= 3
            if any(token in col for token in ["hour", "score", "value", "amount", "gpa", "attendance"]):
                value += 2
            return value

        return sorted(feature_names, key=score, reverse=True)

    def _get_feature_importance(self, used_features):
        """Extract feature influence from common sklearn model attributes."""
        items = []
        try:
            if hasattr(self.model, "feature_importances_"):
                values = np.array(self.model.feature_importances_).reshape(-1)
                for idx, score in enumerate(values):
                    feature = used_features[idx] if idx < len(used_features) else f"feature_{idx}"
                    items.append({
                        "feature": str(feature),
                        "importance": float(score),
                        "abs_importance": float(abs(score)),
                    })
            elif hasattr(self.model, "coef_"):
                coef = np.array(self.model.coef_)
                if coef.ndim > 1:
                    coef = np.mean(np.abs(coef), axis=0)
                coef = coef.reshape(-1)
                for idx, score in enumerate(coef):
                    feature = used_features[idx] if idx < len(used_features) else f"feature_{idx}"
                    items.append({
                        "feature": str(feature),
                        "importance": float(score),
                        "abs_importance": float(abs(score)),
                    })
        except Exception:
            return []

        items.sort(key=lambda x: x["abs_importance"], reverse=True)
        return items[:10]

    def _build_prediction_preview(self, df, predictions, target_column, used_features):
        """Create a compact row-level preview with optional error diagnostics."""
        pred_series = pd.Series(np.array(predictions).reshape(-1))
        preview_size = min(12, len(pred_series), len(df))
        preview = []

        if preview_size == 0:
            return {
                "rows": [],
                "high_risk_count": 0,
                "total_rows": 0,
            }

        error_threshold = None
        error_values = None
        if target_column and target_column in df.columns:
            y_true = pd.to_numeric(df[target_column], errors="coerce")
            y_pred = pd.to_numeric(pred_series, errors="coerce")
            error_values = (y_true - y_pred).abs()
            valid_errors = error_values.dropna()
            if len(valid_errors) > 0:
                error_threshold = float(valid_errors.quantile(0.80))

        for idx in range(preview_size):
            row = df.iloc[idx]
            entry = {
                "row_index": int(idx),
                "predicted": self._to_json_safe(pred_series.iloc[idx]),
            }

            feature_snapshot = {}
            for feature in used_features[:4]:
                if feature in row.index:
                    feature_snapshot[str(feature)] = self._to_json_safe(row[feature])
            entry["feature_snapshot"] = feature_snapshot

            if target_column and target_column in row.index:
                entry["actual"] = self._to_json_safe(row[target_column])

                if error_values is not None and not pd.isna(error_values.iloc[idx]):
                    abs_error = float(error_values.iloc[idx])
                    entry["abs_error"] = abs_error
                    if error_threshold is not None:
                        entry["risk"] = "high" if abs_error >= error_threshold else "normal"

            preview.append(entry)

        high_risk_count = 0
        if error_values is not None and error_threshold is not None:
            high_risk_count = int((error_values >= error_threshold).sum())

        return {
            "rows": preview,
            "high_risk_count": high_risk_count,
            "total_rows": int(len(pred_series)),
            "error_threshold": error_threshold,
        }

    def _build_risk_alerts(self, prediction_preview, schema_check, evaluation):
        """Generate concise, user-facing risk alerts."""
        alerts = []

        if schema_check.get("compatibility_score", 1.0) < 1.0:
            alerts.append(
                f"Schema compatibility is {schema_check['compatibility_score'] * 100:.1f}%. Missing model features may break reliability."
            )

        high_risk_count = prediction_preview.get("high_risk_count", 0)
        total_rows = max(1, prediction_preview.get("total_rows", 0))
        if high_risk_count > 0:
            ratio = (high_risk_count / total_rows) * 100
            alerts.append(
                f"High-error rows detected: {high_risk_count}/{total_rows} ({ratio:.1f}%). Review these records before decision-making."
            )

        if evaluation and evaluation.get("task_type") == "regression":
            if evaluation.get("r2", 0.0) < 0.5:
                alerts.append("Low regression fit detected (R2 < 0.50). Consider retraining or feature engineering.")

        if evaluation and evaluation.get("task_type") == "classification":
            if evaluation.get("f1_weighted", 0.0) < 0.6:
                alerts.append("Low classification quality detected (F1 < 0.60). Check class imbalance or retraining strategy.")

        return alerts

    def _assess_topic_alignment(self, schema_check, used_features, evaluation):
        """Estimate whether uploaded model and dataset are from a compatible topic/domain."""
        score = float(schema_check.get("compatibility_score", 0.0))
        reasons = []

        expected_features = schema_check.get("expected_features", [])
        inferred_features = schema_check.get("inferred_features", [])

        if not expected_features and inferred_features:
            score *= 0.8
            reasons.append("Model feature names are missing; alignment is inferred from shape only.")

        if schema_check.get("missing_features"):
            score *= 0.5
            reasons.append("Some expected model features are missing in dataset.")

        if evaluation and evaluation.get("task_type") == "regression":
            r2 = float(evaluation.get("r2", 0.0))
            if r2 < 0.3:
                score *= 0.6
                reasons.append("Very low regression fit suggests domain mismatch.")

        if evaluation and evaluation.get("task_type") == "classification":
            f1 = float(evaluation.get("f1_weighted", 0.0))
            if f1 < 0.5:
                score *= 0.6
                reasons.append("Low classification F1 suggests potential topic mismatch.")

        score = max(0.0, min(1.0, score))

        if score < 0.5:
            status = "mismatch"
        elif score < 0.75:
            status = "possible_mismatch"
        else:
            status = "aligned"

        if not reasons:
            reasons.append("No strong mismatch signal detected.")

        return {
            "status": status,
            "score": round(score, 4),
            "used_feature_count": int(len(used_features)),
            "reasons": reasons,
        }

    def _build_popup_insight(self, topic_alignment, schema_check, evaluation, risk_alerts):
        """Create short UI-friendly popup insight for mismatch scenarios."""
        status = topic_alignment.get("status", "aligned")

        if status == "aligned":
            return {
                "show_popup": True,
                "severity": "info",
                "title": "Model and dataset look compatible",
                "message": "No major topic mismatch detected.",
                "actions": [
                    "Predictions look usable for this dataset.",
                    "You can continue with evaluation and risk review.",
                ],
            }

        missing = schema_check.get("missing_features", [])
        task_type = evaluation.get("task_type") if evaluation else "unknown"

        actions = [
            "Use a model trained on a similar dataset topic.",
            "Map/rename dataset columns to match model training features.",
            "Retrain model with this dataset domain if possible.",
        ]

        if missing:
            actions.insert(0, f"Missing features found: {', '.join(missing[:5])}")

        if task_type == "regression" and evaluation:
            actions.append(f"Current R2: {float(evaluation.get('r2', 0.0)):.3f}")
        if task_type == "classification" and evaluation:
            actions.append(f"Current F1: {float(evaluation.get('f1_weighted', 0.0)):.3f}")

        if risk_alerts:
            actions.append("Review risk alerts before using predictions.")

        severity = "high" if status == "mismatch" else "medium"
        title = "Model-Dataset Topic Mismatch Detected" if status == "mismatch" else "Possible Model-Dataset Mismatch"

        return {
            "show_popup": True,
            "severity": severity,
            "title": title,
            "message": "Uploaded dataset and model may belong to different contexts.",
            "actions": actions,
        }
