# Insightalysis AI - Testing Guide

## System Status ✅
- **Backend**: Running on http://127.0.0.1:5000
- **Frontend**: Open at file:///c:/AI-T/index.html
- **Sample Data**: Available in backend/uploads/sample_data.csv
- **Sample Model**: Available at backend/models/study_predictor.pkl

---

## Quick Test Steps

### 1. **Test CSV Analysis**
- Click "📁 Upload Files" section
- Drag & drop `backend/uploads/sample_data.csv` or browse to select it
- Click "Analyze CSV Data" button
- Expected Result: See data overview, missing values, descriptive statistics, correlations, and outliers

### 2. **Test Model Upload**
- Scroll to "🤖 Upload ML Model" section
- Browse to `backend/models/study_predictor.pkl`
- Click upload
- Expected Result: Message "Model loaded successfully!"

### 3. **Test Predictions**
- After model is loaded, scroll to "🎯 Make Predictions" section
- Enter a value (e.g., "6" for 6 study hours)
- Click "Get Prediction"
- Expected Result: Should see prediction like "Predicted Marks: ~76" (approximately 6.25×6 + 42.93)

### 4. **Test PDF Analysis**
- Create or obtain a PDF file
- Click "📁 Upload Files" section
- Select PDF file
- Click "Analyze PDF Document" button
- Expected Result: See summary, key concepts, text sections, and generated questions

---

## API Endpoints (For Advanced Testing)

All endpoints available at: http://127.0.0.1:5000

### Health Check
```
GET /health
```

### CSV Analysis
```
POST /analyze-csv
Body: multipart/form-data with 'file' field
```

### PDF Analysis
```
POST /analyze-pdf
Body: multipart/form-data with 'file' field
```

### Model Upload
```
POST /upload-model
Body: multipart/form-data with 'model_file' field (.pkl file)
```

### Analyze CSV + Model Together
```
POST /analyze-with-model
Body: multipart/form-data with:
	- dataset_file (csv)
	- model_file (.pkl)
	- target_column (optional)
```

### List Models
```
GET /list-models
```

### Make Predictions
```
POST /predict
Body: JSON {"value": 5}
```

---

## Sample Data Reference

**Sample CSV Columns:**
- StudentID: 1-15
- StudyHours: 3.2 - 8.1 hours
- Attendance: 65 - 98 percent
- GPA: 2.1 - 3.9 scale
- Marks: 58 - 95 points

**Sample Model:**
- Type: Linear Regression
- Formula: Marks = 6.25 × StudyHours + 42.93
- Example: 5 hours → ~74.18 marks

---

## Troubleshooting

### Backend Not Running
```powershell
cd c:\AI-T\backend
c:/AI-T/.venv/Scripts/python.exe app.py
```

### Missing Dependencies
```powershell
cd c:\AI-T\backend
pip install -r requirements.txt
```

### File Upload Issues
- Ensure files are < 64MB
- CSV must be valid format
- PDF must be readable
- Model files must be .pkl format

### CORS Issues
- Ensure backend is running on http://127.0.0.1:5000
- Clear browser cache and reload page

---

## Features Implemented

✅ Frontend Interface
- File upload (drag & drop)
- Analysis type selection
- Results display with formatted output
- Model upload capability
- Prediction interface

✅ Backend API
- 8 RESTful endpoints
- CSV analysis (5-step pipeline)
- PDF processing (text extraction, summarization)
- ML predictions
- Model management

✅ Data Analysis
- Descriptive statistics
- Correlation analysis
- Outlier detection
- Missing value handling

✅ ML Integration
- Model loading from .pkl files
- Custom predictions
- Batch prediction support

---

## Next Steps

1. Upload sample CSV to test analysis
2. Load sample model to test predictions
3. Create your own CSV data for custom analysis
4. Train custom models using backend/train_models.py
5. Upload custom models via web interface
