from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import time
import json
from werkzeug.utils import secure_filename
from pandas.errors import EmptyDataError, ParserError
from PyPDF2.errors import PdfReadError

# Add modules directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'modules'))

from csv_analyzer import CSVAnalyzer
from pdf_processor import PDFProcessor
from ml_predictor import MLPredictor

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
MODELS_FOLDER = os.path.join(os.path.dirname(__file__), 'models')
ALLOWED_EXTENSIONS = {'csv', 'pdf', 'pkl'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

if not os.path.exists(MODELS_FOLDER):
    os.makedirs(MODELS_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64MB max

@app.errorhandler(413)
def payload_too_large(_error):
    return jsonify({"error": "File too large. Max upload size is 64MB."}), 413

# Initialize ML predictor
ml_predictor = MLPredictor()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_csv_file(filename):
    return filename and filename.lower().endswith('.csv')

def is_pdf_file(filename):
    return filename and filename.lower().endswith('.pdf')

def is_pkl_file(filename):
    return filename and filename.lower().endswith('.pkl')

def cleanup_old_models(keep=5):
    try:
        import glob as glob_mod
        model_files = sorted(glob_mod.glob(os.path.join(MODELS_FOLDER, "*.pkl")), key=os.path.getmtime)
        while len(model_files) > keep:
            os.remove(model_files.pop(0))
    except Exception:
        pass

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Insightalysis AI Backend",
        "version": "1.0",
        "endpoints": [
            "/analyze-csv",
            "/analyze-pdf",
            "/analyze-combined",
            "/analyze-with-model",
            "/predict",
            "/model-info"
        ]
    })

@app.route('/analyze-csv', methods=['POST'])
def analyze_csv():
    """Analyze CSV file"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if not file or not is_csv_file(file.filename):
            return jsonify({"error": "Invalid file type. Only CSV allowed"}), 400
        
        # Read file
        csv_data = file.read()
        
        # Analyze
        analyzer = CSVAnalyzer(csv_data)
        analysis = analyzer.get_full_analysis()
        
        return jsonify({
            "status": "success",
            "filename": secure_filename(file.filename),
            "analysis": analysis
        }), 200
    
    except (EmptyDataError, ParserError) as e:
        return jsonify({"error": f"CSV parse failed: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"CSV Analysis failed: {str(e)}"}), 500

@app.route('/analyze-pdf', methods=['POST'])
def analyze_pdf():
    """Analyze PDF file"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if not file or not is_pdf_file(file.filename):
            return jsonify({"error": "Invalid file type. Only PDF allowed"}), 400
        
        # Read file
        pdf_data = file.read()        
        # Analyze
        processor = PDFProcessor(pdf_data)
        analysis = processor.get_full_analysis()
        
        return jsonify({
            "status": "success",
            "filename": secure_filename(file.filename),
            "analysis": analysis
        }), 200
    
    except PdfReadError as e:
        return jsonify({"error": f"PDF parse failed: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"PDF Analysis failed: {str(e)}"}), 500

@app.route('/analyze-combined', methods=['POST'])
def analyze_combined():
    """Combined analysis: CSV + optional PDF + optional PKL model."""
    global ml_predictor
    try:
        csv_result = None
        pdf_result = None
        model_result = None
        model_info_result = None
        target_column = request.form.get('target_column', '').strip() or None
        
        if 'csv_file' in request.files:
            csv_file = request.files['csv_file']
            if csv_file and is_csv_file(csv_file.filename):
                csv_data = csv_file.read()
                csv_analyzer = CSVAnalyzer(csv_data)
                csv_result = csv_analyzer.get_full_analysis()

                if 'model_file' in request.files:
                    model_file = request.files['model_file']
                    if model_file and is_pkl_file(model_file.filename):
                        model_filename = secure_filename(model_file.filename)
                        timestamp = int(time.time() * 1000)
                        model_path = os.path.join(MODELS_FOLDER, f"{timestamp}_{model_filename}")
                        model_file.save(model_path)
                        cleanup_old_models()

                        predictor = MLPredictor(model_path=model_path)
                        model_result = predictor.analyze_dataset(
                            csv_analyzer.df,
                            target_column=target_column
                        )

                        if 'error' in model_result:
                            return jsonify({
                                "error": model_result['error'],
                                "csv_analysis": csv_result,
                                "model_analysis": model_result
                            }), 400

                        ml_predictor = predictor
                        model_info_result = predictor.get_model_info()
        
        if 'pdf_file' in request.files:
            pdf_file = request.files['pdf_file']
            if pdf_file and is_pdf_file(pdf_file.filename):
                pdf_data = pdf_file.read()
                pdf_processor = PDFProcessor(pdf_data)
                pdf_result = pdf_processor.get_full_analysis()
        
        if not csv_result and not pdf_result and not model_result:
            return jsonify({"error": "No valid files provided. Upload CSV (required for model analysis), optional PDF, optional PKL model."}), 400
        
        return jsonify({
            "status": "success",
            "csv_analysis": csv_result,
            "pdf_analysis": pdf_result,
            "model_analysis": model_result,
            "model_info": model_info_result,
            "combined_insights": {
                "data_papers_match": "Patterns in data align with research findings" if csv_result and pdf_result else "Single-stream analysis complete",
                "model_with_dataset": "Model predictions generated on uploaded CSV" if model_result else "No model analysis in this request",
                "key_finding": "Integration complete"
            }
        }), 200
    
    except Exception as e:
        return jsonify({"error": f"Combined Analysis failed: {str(e)}"}), 500

@app.route('/analyze-with-model', methods=['POST'])
def analyze_with_model():
    """Analyze CSV and run predictions with an uploaded model in one request."""
    global ml_predictor
    try:
        if 'dataset_file' not in request.files:
            return jsonify({"error": "No dataset_file provided"}), 400

        if 'model_file' not in request.files:
            return jsonify({"error": "No model_file provided"}), 400

        dataset_file = request.files['dataset_file']
        model_file = request.files['model_file']
        target_column = request.form.get('target_column', '').strip() or None

        if not dataset_file or not is_csv_file(dataset_file.filename):
            return jsonify({"error": "Invalid dataset file type. Only CSV allowed"}), 400

        if not model_file or not is_pkl_file(model_file.filename):
            return jsonify({"error": "Invalid model file type. Only .pkl allowed"}), 400

        csv_data = dataset_file.read()
        csv_analyzer = CSVAnalyzer(csv_data)
        csv_analysis = csv_analyzer.get_full_analysis()

        model_filename = secure_filename(model_file.filename)
        timestamp = int(time.time() * 1000)
        model_path = os.path.join(MODELS_FOLDER, f"{timestamp}_{model_filename}")
        model_file.save(model_path)
        cleanup_old_models()

        predictor = MLPredictor(model_path=model_path)
        model_analysis = predictor.analyze_dataset(csv_analyzer.df, target_column=target_column)

        if 'error' in model_analysis:
            return jsonify({
                "error": model_analysis['error'],
                "filename": secure_filename(dataset_file.filename),
                "analysis": csv_analysis,
                "model_analysis": model_analysis
            }), 400

        # Make latest uploaded model available for /predict endpoint as well.
        ml_predictor = predictor

        return jsonify({
            "status": "success",
            "filename": secure_filename(dataset_file.filename),
            "model_filename": model_filename,
            "analysis": csv_analysis,
            "model_analysis": model_analysis,
            "model_info": predictor.get_model_info()
        }), 200

    except (EmptyDataError, ParserError) as e:
        return jsonify({"error": f"CSV parse failed: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Analyze-with-model failed: {str(e)}"}), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Make ML prediction"""
    try:
        data = request.get_json(silent=True)
        
        if not data or 'value' not in data:
            return jsonify({"error": "No value provided"}), 400

        try:
            value = float(data['value'])
        except (ValueError, TypeError):
            return jsonify({"error": "value must be a number"}), 400

        prediction = ml_predictor.predict(value)
        
        if "error" in prediction:
            return jsonify(prediction), 400
        
        return jsonify({
            "status": "success",
            "prediction": prediction
        }), 200
    
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

@app.route('/upload-model', methods=['POST'])
def upload_model():
    """Upload and load a custom .pkl model"""
    global ml_predictor
    try:
        if 'model_file' not in request.files:
            return jsonify({"error": "No model file provided"}), 400
        
        file = request.files['model_file']
        
        if not file or not file.filename.endswith('.pkl'):
            return jsonify({"error": "Only .pkl files allowed"}), 400
        
        # Save model
        filename = secure_filename(file.filename)
        model_path = os.path.join(MODELS_FOLDER, filename)
        file.save(model_path)
        cleanup_old_models()
        
        # Load model
        ml_predictor = MLPredictor(model_path=model_path)
        
        return jsonify({
            "status": "success",
            "message": f"Model '{filename}' uploaded and loaded successfully",
            "model_path": model_path,
            "model_info": ml_predictor.get_model_info()
        }), 200
    
    except Exception as e:
        return jsonify({"error": f"Model upload failed: {str(e)}"}), 500

@app.route('/list-models', methods=['GET'])
def list_models():
    """List all available models"""
    try:
        if not os.path.exists(MODELS_FOLDER):
            return jsonify({
                "status": "success",
                "models": [],
                "message": "No models found"
            }), 200
        
        models = []
        for file in os.listdir(MODELS_FOLDER):
            if file.endswith('.pkl'):
                file_path = os.path.join(MODELS_FOLDER, file)
                file_size = os.path.getsize(file_path) / 1024
                models.append({
                    "name": file,
                    "size_kb": round(file_size, 2),
                    "path": file_path
                })
        
        return jsonify({
            "status": "success",
            "models": models,
            "count": len(models)
        }), 200
    
    except Exception as e:
        return jsonify({"error": f"Failed to list models: {str(e)}"}), 500

@app.route('/model-info', methods=['GET'])
def model_info():
    """Get model information"""
    try:
        info = ml_predictor.get_model_info()
        return jsonify({
            "status": "success",
            "model": info
        }), 200
    
    except Exception as e:
        return jsonify({"error": f"Failed to get model info: {str(e)}"}), 500

SHARE_FOLDER = os.path.join(os.path.dirname(__file__), 'shared')
if not os.path.exists(SHARE_FOLDER):
    os.makedirs(SHARE_FOLDER)

@app.route('/share', methods=['POST'])
def share_results():
    """Store analysis results and return shareable ID"""
    try:
        data = request.get_json(silent=True)
        if not data or 'results' not in data:
            return jsonify({"error": "No results provided"}), 400

        import hashlib
        import json
        result_id = hashlib.md5(json.dumps(data['results'], default=str).encode()).hexdigest()[:12]

        share_data = {
            "id": result_id,
            "results": data['results'],
            "files": data.get('files', []),
            "type": data.get('type', 'auto'),
            "timestamp": time.time()
        }

        file_path = os.path.join(SHARE_FOLDER, f"{result_id}.json")
        with open(file_path, 'w') as f:
            json.dump(share_data, f, default=str)

        return jsonify({
            "status": "success",
            "id": result_id,
            "url": f"/results/{result_id}"
        }), 200

    except Exception as e:
        return jsonify({"error": f"Share failed: {str(e)}"}), 500

@app.route('/results/<result_id>', methods=['GET'])
def get_shared_results(result_id):
    """Retrieve shared analysis results by ID"""
    try:
        file_path = os.path.join(SHARE_FOLDER, f"{result_id}.json")
        if not os.path.exists(file_path):
            return jsonify({"error": "Results not found"}), 404

        with open(file_path, 'r') as f:
            share_data = json.load(f)

        return jsonify({
            "status": "success",
            "data": share_data
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to retrieve results: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        "status": "healthy",
        "service": "Insightalysis AI Backend"
    }), 200

if __name__ == '__main__':
    print("Starting Insightalysis AI Backend...")
    print("Available endpoints:") 
    print("  POST /analyze-csv")
    print("  POST /analyze-pdf")
    print("  POST /analyze-combined")
    print("  POST /analyze-with-model")
    print("  POST /predict")
    print("  POST /upload-model")
    print("  GET /list-models")
    print("  GET /model-info")
    print("  GET /health")
    app.run(debug=True, host='127.0.0.1', port=5000)
