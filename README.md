# Insightalysis AI

Insightalysis AI is a modern research and dataset analytics platform built to accelerate insights from academic papers, structured datasets, and machine learning models. The project unifies CSV profiling, PDF content analysis, and model evaluation into a single local workflow.

## Overview

Insightalysis AI enables users to:

- Perform advanced dataset analysis on CSV files
- Extract and summarize research content from PDF papers
- Combine data and document analysis for richer insight
- Apply serialized machine learning models to datasets
- Operate through a lightweight browser popup interface backed by a local Flask service

## Core Capabilities

- CSV analytics with automated summary statistics, missing value detection, and structural profiling
- PDF processing for text extraction, research summarization, and document insight generation
- Combined analysis that supports multi-source workflows (CSV + PDF + model)
- `.pkl` model upload support for dataset evaluation and prediction
- Local API health checks and secure file validation

## Repository Layout

- `backend/`
  - `app.py` — Flask backend application with REST endpoints
  - `requirements.txt` — Python dependency manifest
  - `modules/` — implementation modules for CSV, PDF, and ML analysis
  - `uploads/` — runtime upload storage and sample files
  - `models/` — persisted model artifacts
  - `run_pdf_test.py` — PDF generation and analysis validation script
- `css/` — popup UI styling
- `js/` — frontend application logic
- `popup.html` — browser popup interface entry point
- `manifest.json` — local extension manifest
- `setup.bat`, `setup.sh`, `run_backend.bat` — execution helpers
- `README.md` — project documentation

## Installation

1. Install Python dependencies:

   ```bash
   cd backend
   python -m pip install -r requirements.txt
   ```

2. Start the backend service:

   ```bash
   python app.py
   ```

3. Confirm the backend is running at `http://127.0.0.1:5000`.

## Usage Guide

### Popup Interface

- Open `popup.html` in a compatible browser or load it as a local extension UI
- Upload one or more supported files: `.csv`, `.pdf`, `.pkl`
- Optionally specify a target column for model evaluation
- Choose an analysis mode and click **Start Analysis**

### Supported Modes

- **Auto** — dynamically select the best analysis flow based on uploaded files
- **CSV** — dataset analytics for CSV input
- **PDF** — research paper processing and summarization
- **Combined** — integrated analysis of CSV, PDF, and optional model content

## Backend API Reference

- `GET /` — service metadata and available endpoints
- `POST /analyze-csv` — process CSV uploads
- `POST /analyze-pdf` — process PDF uploads
- `POST /analyze-combined` — combine CSV, PDF, and optional model analysis
- `POST /analyze-with-model` — analyze a CSV dataset with an uploaded `.pkl` model
- `GET /health` — backend health verification endpoint

## Technical Notes

- Maximum upload size is `64 MB`
- Supported upload formats: `.csv`, `.pdf`, `.pkl`
- The frontend is configured to communicate with the backend at `http://127.0.0.1:5000`
- `Flask-CORS` is enabled to support browser-based requests

## Development

This repository is structured to support iterative enhancements across the following components:

- `backend/modules/csv_analyzer.py` — dataset profiling and analytics logic
- `backend/modules/pdf_processor.py` — PDF text extraction and summarization logic
- `backend/modules/ml_predictor.py` — model loading, prediction, and evaluation logic
- `js/popup.js` — frontend interaction, file handling, and API orchestration

## Contribution

Contributions are welcome. Suggested improvements include:

- Enhancing dataset profiling and statistical reports
- Improving PDF extraction accuracy and insight generation
- Extending model support and prediction diagnostics
- Refining the popup user experience and error handling

## License

Specify the project license here.
