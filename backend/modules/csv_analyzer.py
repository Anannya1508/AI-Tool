import pandas as pd
import numpy as np
from io import StringIO, BytesIO

class CSVAnalyzer:
    def __init__(self, csv_data):
        """
        Initialize with CSV data (file path or dataframe)
        """
        if isinstance(csv_data, str):
            self.df = pd.read_csv(csv_data)
        elif isinstance(csv_data, bytes):
            self.df = pd.read_csv(BytesIO(csv_data))
        else:
            self.df = csv_data

    def get_overview(self):
        """Step 1: Data Overview"""
        return {
            "rows": int(self.df.shape[0]),
            "columns": int(self.df.shape[1]),
            "column_names": self.df.columns.tolist(),
            "data_types": self.df.dtypes.astype(str).to_dict(),
            "memory_usage": f"{self.df.memory_usage(deep=True).sum() / 1024:.2f} KB"
        }

    def get_missing_values(self):
        """Step 2: Missing Values Analysis"""
        missing = self.df.isnull().sum()
        missing_pct = (missing / len(self.df)) * 100
        
        suggestions = {}
        for col in self.df.columns:
            if missing[col] > 0:
                if self.df[col].dtype in ['float64', 'int64']:
                    suggestions[col] = f"Median: {self.df[col].median()}"
                else:
                    suggestions[col] = f"Mode: {self.df[col].mode()[0] if len(self.df[col].mode()) > 0 else 'N/A'}"
        
        return {
            "missing_counts": missing.to_dict(),
            "missing_percentage": missing_pct.to_dict(),
            "suggestions": suggestions
        }

    def get_descriptive_stats(self):
        """Step 3: Descriptive Statistics"""
        numeric_df = self.df.select_dtypes(include=[np.number])
        
        stats = {
            "mean": numeric_df.mean().to_dict(),
            "median": numeric_df.median().to_dict(),
            "min": numeric_df.min().to_dict(),
            "max": numeric_df.max().to_dict(),
            "std_dev": numeric_df.std().to_dict()
        }
        
        # Convert NaN to None for JSON serialization
        for key in stats:
            stats[key] = {k: (None if pd.isna(v) else float(v)) for k, v in stats[key].items()}
        
        return stats

    def get_correlations(self):
        """Step 5: Correlation Analysis"""
        numeric_df = self.df.select_dtypes(include=[np.number])
        
        if numeric_df.shape[1] < 2:
            return {"message": "Need at least 2 numeric columns for correlation"}
        
        corr_matrix = numeric_df.corr()
        
        # Find strong correlations
        strong_corr = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                corr_val = corr_matrix.iloc[i, j]
                if abs(corr_val) > 0.7:
                    strong_corr.append({
                        "var1": corr_matrix.columns[i],
                        "var2": corr_matrix.columns[j],
                        "correlation": float(corr_val)
                    })
        
        return {
            "correlation_matrix": {str(k): {str(col): (None if pd.isna(v) else float(v)) for col, v in row.items()} 
                                  for k, row in corr_matrix.items()},
            "strong_correlations": strong_corr
        }

    def get_outliers(self):
        """Step 5: Outlier Detection using IQR"""
        numeric_df = self.df.select_dtypes(include=[np.number])
        outliers = {}
        
        for col in numeric_df.columns:
            Q1 = numeric_df[col].quantile(0.25)
            Q3 = numeric_df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outlier_count = len(numeric_df[(numeric_df[col] < lower_bound) | (numeric_df[col] > upper_bound)])
            outliers[col] = {
                "count": int(outlier_count),
                "percentage": float((outlier_count / len(numeric_df)) * 100)
            }
        
        return outliers

    def get_visualization_data(self):
        """Step 4: visualization-ready dataset stats"""
        numeric_df = self.df.select_dtypes(include=[np.number])
        viz = {}

        for col in numeric_df.columns[:4]:
            series = numeric_df[col].dropna()
            if series.empty:
                continue
            bin_count = min(10, max(5, int(len(series) / 3)))
            hist, edges = np.histogram(series, bins=bin_count)

            viz[col] = {
                "bins": [float(v) for v in edges.tolist()],
                "counts": [int(v) for v in hist.tolist()],
                "min": float(series.min()),
                "max": float(series.max()),
                "mean": float(series.mean()),
                "median": float(series.median())
            }

        return viz

    def get_feature_insights(self):
        """Step 5: Model insight hints and strong patterns"""
        corr_data = self.get_correlations()
        strong = corr_data.get('strong_correlations') if isinstance(corr_data, dict) else []

        patterns = []
        for item in strong:
            corr_val = item.get('correlation', 0)
            if abs(corr_val) >= 0.9:
                patterns.append(f"Very strong correlation: {item['var1']} <-> {item['var2']} ({corr_val:.2f})")
            elif abs(corr_val) >= 0.75:
                patterns.append(f"Strong correlation: {item['var1']} <-> {item['var2']} ({corr_val:.2f})")

        if not patterns:
            patterns.append('No very strong patterns found; dataset may need feature engineering.')

        return {
            "strong_patterns": patterns,
            "correlation_summary": corr_data
        }

    def get_followup_ideas(self):
        """Step 6: Recommended next steps based on data characteristics"""
        insights = []
        recommendations = []

        overview = self.get_overview()
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = self.df.select_dtypes(include=['object', 'category']).columns.tolist()
        missing_counts = self.get_missing_values().get('missing_counts', {})
        corr = self.get_correlations().get('strong_correlations', [])

        # Data quality suggestions
        if any(v > 0 for v in missing_counts.values()):
            insights.append('Handle missing values: impute or drop high-null columns to improve prediction quality.')

        if corr:
            insights.append('Highly correlated features found; consider feature selection or combining correlated variables.')

        if overview['rows'] < 1000:
            insights.append('Dataset is small: use cross-validation and data augmentation to prevent overfitting.')
        else:
            insights.append('Large dataset: perform stratified sampling and use ensemble models for robust performance.')

        # Data-specific ML recommendations
        if len(numeric_cols) >= 2:
            target_candidates = [c for c in numeric_cols if self.df[c].nunique() > 10]
            if target_candidates:
                target = target_candidates[-1]
                skewness = self.df[target].skew()
                if abs(skewness) < 1:
                    recommendations.append({
                        "type": "Regression",
                        "reason": f"'{target}' appears continuous with balanced distribution (skewness={skewness:.2f}). Linear Regression, Random Forest Regressor, or XGBoost Regressor are recommended.",
                        "algorithms": ["Linear Regression", "Random Forest Regressor", "XGBoost Regressor", "SVR"]
                    })
                else:
                    recommendations.append({
                        "type": "Regression (skewed)",
                        "reason": f"'{target}' is skewed (skewness={skewness:.2f}). Consider log transformation before regression or use tree-based models.",
                        "algorithms": ["Random Forest Regressor", "Gradient Boosting", "XGBoost Regressor"]
                    })

        if len(numeric_cols) >= 2:
            unique_ratios = {}
            for col in numeric_cols:
                unique_ratios[col] = self.df[col].nunique() / len(self.df)

            low_unique = [c for c, r in unique_ratios.items() if r < 0.05 and self.df[c].nunique() >= 2 and self.df[c].nunique() <= 10]
            if low_unique:
                target_col = low_unique[-1]
                n_classes = self.df[target_col].nunique()
                recommendations.append({
                    "type": "Classification",
                    "reason": f"'{target_col}' has only {n_classes} distinct values, suitable as a classification target.",
                    "algorithms": ["Logistic Regression", "Random Forest Classifier", "SVM", "K-Nearest Neighbors"]
                })

        if len(numeric_cols) >= 3 and overview['rows'] >= 20:
            recommendations.append({
                "type": "Clustering",
                "reason": f"Dataset has {len(numeric_cols)} numeric features. Clustering can reveal natural groupings.",
                "algorithms": ["K-Means", "DBSCAN", "Hierarchical Clustering", "Gaussian Mixture"]
            })

        if len(numeric_cols) >= 3:
            recommendations.append({
                "type": "Dimensionality Reduction",
                "reason": f"With {len(numeric_cols)} numeric features, PCA or t-SNE can help visualize patterns.",
                "algorithms": ["PCA", "t-SNE", "UMAP"]
            })

        if not recommendations:
            recommendations.append({
                "type": "Exploratory Analysis",
                "reason": "Dataset characteristics suggest exploratory data analysis first.",
                "algorithms": ["K-Means", "DBSCAN", "Hierarchical Clustering"]
            })

        return {
            "ideas": insights,
            "recommendations": recommendations,
            "risk_alerts": self.get_risk_alerts()
        }

    def get_risk_alerts(self):
        """Risk alerts by dataset analysis"""
        alerts = []

        missing = self.get_missing_values().get('missing_counts', {})
        if any(v > 0 for v in missing.values()):
            alerts.append('Risk: Missing values indicate possible bias if nulls are not missing at random.')

        if self.df.select_dtypes(include=[np.number]).shape[1] > 0:
            zero_var_cols = [c for c in self.df.select_dtypes(include=[np.number]).columns if self.df[c].nunique() <= 1]
            if zero_var_cols:
                alerts.append(f'Risk: Constant features detected ({len(zero_var_cols)}), which may not help modeling and can bias feature importance.')

        corr = self.get_correlations().get('strong_correlations', [])
        if len(corr) > 3:
            alerts.append('Risk: Many strong correlations may indicate multicollinearity in regression models; consider feature selection.')

        if self.df.shape[0] < 50:
            alerts.append('Risk: Very small sample size; model generalization may be poor and uncertainty high.')

        if not alerts:
            alerts.append('No major dataset risks detected; data looks good for next-step analysis.')

        return alerts

    def _sanitize(self, obj):
        """Recursively convert NaN/inf to None and NumPy types to Python types."""
        if isinstance(obj, dict):
            return {k: self._sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._sanitize(v) for v in obj]
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, (float,)):
            if pd.isna(obj) or np.isnan(obj) or np.isinf(obj):
                return None
            return obj
        if obj is None:
            return None
        if isinstance(obj, str):
            return obj
        if isinstance(obj, bool):
            return obj
        try:
            if pd.isna(obj):
                return None
        except Exception:
            pass
        return obj

    def get_full_analysis(self):
        """Get all analysis in one call"""
        result = {
            "overview": self.get_overview(),
            "missing_values": self.get_missing_values(),
            "descriptive_stats": self.get_descriptive_stats(),
            "correlations": self.get_correlations(),
            "outliers": self.get_outliers(),
            "visualization_data": self.get_visualization_data(),
            "feature_insights": self.get_feature_insights(),
            "followup_ideas": self.get_followup_ideas(),
            "sample_rows": self.df.head(8).to_dict(orient='records'),
            "questions": self.generate_questions()
        }
        return self._sanitize(result)

    def generate_questions(self):
        """Generate meaningful practice questions based on CSV data"""
        questions = []
        overview = self.get_overview()
        stats = self.get_descriptive_stats()
        missing = self.get_missing_values()
        corr = self.get_correlations()
        outliers = self.get_outliers()

        # Question 1: Dataset dimensions
        rows = overview['rows']
        cols = overview['columns']
        wrong_opts = [f"{rows - 5}", f"{rows + 5}", f"{rows + 10}"]
        questions.append({
            "id": "csv_q1",
            "question": f"How many rows does the dataset contain?",
            "options": [str(rows), wrong_opts[0], wrong_opts[1], wrong_opts[2]],
            "correctIndex": 0
        })

        # Question 2: Column names
        col_names = overview['column_names']
        if len(col_names) >= 2:
            distractors = ["[None of these]", "[All of these]"]
            questions.append({
                "id": "csv_q2",
                "question": f"Which of the following is a column name in this dataset?",
                "options": [col_names[0], col_names[-1], distractors[0], distractors[1]],
                "correctIndex": 0
            })

        # Question 3: Numeric columns count
        numeric_cols = [c for c in col_names if overview['data_types'].get(c, '').startswith(('int', 'float'))]
        wrong = [str(max(0, len(numeric_cols) - 2)), str(len(numeric_cols) + 1), str(len(numeric_cols) + 3)]
        questions.append({
            "id": "csv_q3",
            "question": "How many numeric columns are in the dataset?",
            "options": [str(len(numeric_cols)), wrong[0], wrong[1], wrong[2]],
            "correctIndex": 0
        })

        # Question 4: Missing values
        total_missing = sum(missing.get('missing_counts', {}).values())
        questions.append({
            "id": "csv_q4",
            "question": "Does the dataset contain any missing values?",
            "options": ["Yes", "No"],
            "correctIndex": 0 if total_missing > 0 else 1
        })

        # Question 5: Correlation
        strong_corr = corr.get('strong_correlations', [])
        questions.append({
            "id": "csv_q5",
            "question": f"How many strong correlations (|r| > 0.7) were found?",
            "options": [str(len(strong_corr)), str(len(strong_corr) + 1), str(len(strong_corr) + 3), "0"],
            "correctIndex": 0
        })

        # Question 6: Outliers
        total_outliers = sum(o.get('count', 0) for o in outliers.values())
        questions.append({
            "id": "csv_q6",
            "question": "Are there outliers detected using the IQR method?",
            "options": ["Yes", "No"],
            "correctIndex": 0 if total_outliers > 0 else 1
        })

        # Question 7: Column type
        if numeric_cols:
            questions.append({
                "id": "csv_q7",
                "question": f"What is the data type of '{numeric_cols[0]}'?",
                "options": ["Numeric (int/float)", "Text (string)", "Boolean", "Date"],
                "correctIndex": 0
            })

        return questions[:5]
