const API_URL = 'http://127.0.0.1:5000';
let uploadedFiles = [];
let selectedAnalysisType = 'auto';
let analysisResults = null;
let insightPopupShown = false;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const analysisSection = document.getElementById('analysisSection');
const statusBox = document.getElementById('statusBox');
const resultsContainer = document.getElementById('resultsContainer');
const targetColumnInput = document.getElementById('targetColumnInput');

// Check Backend
async function checkBackend() {
    try {
        statusBox.textContent = '🔄 Checking...';
        statusBox.classList.add('active');
        const response = await fetch(`${API_URL}/health`);
        statusBox.classList.remove('error');
        statusBox.textContent = '✅ Backend connected!';
    } catch (error) {
        statusBox.classList.add('error');
        statusBox.textContent = '❌ Backend not connected. Start backend server.';
    }
}

// Drag & Drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#10b981';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#6366f1';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    const valid = Array.from(files).filter((file) => {
        const name = file.name.toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.pdf') || name.endsWith('.pkl');
    });
    uploadedFiles = valid;
    displayFileList();
    analysisSection.style.display = 'block';
}

function displayFileList() {
    fileList.innerHTML = '';
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '<p style="text-align:center; color:#9ca3af; font-size:10px;">No files</p>';
        return;
    }
    uploadedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div><strong>${file.name}</strong></div>
            <button class="btn-remove" onclick="removeFile(${index})">✕</button>
        `;
        fileList.appendChild(fileItem);
    });
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    displayFileList();
    if (uploadedFiles.length === 0) {
        analysisSection.style.display = 'none';
    }
}

document.querySelectorAll('.btn-analysis').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-analysis').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedAnalysisType = e.target.dataset.type;
    });
});

document.getElementById('analyzeBtn').addEventListener('click', analyzeFiles);

async function analyzeFiles() {
    if (uploadedFiles.length === 0) {
        alert('Upload files first!');
        return;
    }

    resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analyzing...</p></div>';
    try {
        await ensureBackendAvailable();
        analysisResults = null;
        insightPopupShown = false;
        const hasCSV = uploadedFiles.some(f => f.name.endsWith('.csv'));
        const hasPDF = uploadedFiles.some(f => f.name.endsWith('.pdf'));
        const hasModel = uploadedFiles.some(f => f.name.endsWith('.pkl'));

        if (selectedAnalysisType === 'csv') {
            if (!hasCSV) throw new Error('CSV file not found');
            if (hasModel) await analyzeCSVWithModel();
            else await analyzeCSVFile();
        } else if (selectedAnalysisType === 'pdf') {
            if (!hasPDF) throw new Error('PDF file not found');
            await analyzePDFFile();
        } else if (selectedAnalysisType === 'combined') {
            if (!hasCSV) throw new Error('Combined analysis requires a CSV file');
            await analyzeCombined();
        } else {
            if (hasCSV && hasPDF && !hasModel) {
                await analyzeCombined();
            } else {
                if (hasCSV && hasModel) await analyzeCSVWithModel();
                else if (hasCSV) await analyzeCSVFile();
                if (hasPDF) await analyzePDFFile();
            }
        }

        displayResults();
        showTopicMismatchPopup();
    } catch (error) {
        resultsContainer.innerHTML = `<div class="result-card"><h3>❌ Error</h3><div class="content-box">${error.message}</div></div>`;
    }
}

async function ensureBackendAvailable() {
    let response;
    try {
        response = await fetch(`${API_URL}/health`);
    } catch (error) {
        throw new Error('Backend unreachable. Start backend on http://127.0.0.1:5000');
    }

    if (!response.ok) {
        throw new Error(`Backend health check failed (${response.status})`);
    }
}

async function analyzeCSVFile() {
    const csvFile = uploadedFiles.find(f => f.name.endsWith('.csv'));
    if (!csvFile) throw new Error('CSV file not found');
    const formData = new FormData();
    formData.append('file', csvFile);
    const response = await fetch(`${API_URL}/analyze-csv`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) throw new Error('CSV analysis failed');
    const result = await response.json();
    analysisResults = { ...(analysisResults || {}), csv: result.analysis };
}

async function analyzePDFFile() {
    const pdfFile = uploadedFiles.find(f => f.name.endsWith('.pdf'));
    if (!pdfFile) throw new Error('PDF file not found');
    const formData = new FormData();
    formData.append('file', pdfFile);
    const response = await fetch(`${API_URL}/analyze-pdf`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) throw new Error('PDF analysis failed');
    const result = await response.json();
    analysisResults = { ...(analysisResults || {}), pdf: result.analysis };
}

async function analyzeCSVWithModel() {
    const csvFile = uploadedFiles.find(f => f.name.endsWith('.csv'));
    const modelFile = uploadedFiles.find(f => f.name.endsWith('.pkl'));
    if (!csvFile) throw new Error('CSV file not found');
    if (!modelFile) throw new Error('Model (.pkl) file not found');

    const formData = new FormData();
    formData.append('dataset_file', csvFile);
    formData.append('model_file', modelFile);

    const targetColumn = targetColumnInput ? targetColumnInput.value.trim() : '';
    if (targetColumn) {
        formData.append('target_column', targetColumn);
    }

    const response = await fetch(`${API_URL}/analyze-with-model`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'CSV + model analysis failed');
    }

    analysisResults = {
        ...(analysisResults || {}),
        csv: result.analysis,
        model: result.model_analysis,
        modelInfo: result.model_info,
    };
}

async function analyzeCombined() {
    const csvFile = uploadedFiles.find(f => f.name.endsWith('.csv'));
    const pdfFile = uploadedFiles.find(f => f.name.endsWith('.pdf'));
    const modelFile = uploadedFiles.find(f => f.name.endsWith('.pkl'));

    if (!csvFile) throw new Error('CSV file is required for combined analysis');

    const formData = new FormData();
    formData.append('csv_file', csvFile);
    if (pdfFile) formData.append('pdf_file', pdfFile);
    if (modelFile) formData.append('model_file', modelFile);

    const targetColumn = targetColumnInput ? targetColumnInput.value.trim() : '';
    if (targetColumn) {
        formData.append('target_column', targetColumn);
    }

    const response = await fetch(`${API_URL}/analyze-combined`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Combined analysis failed');
    }
    const result = await response.json();
    analysisResults = {
        ...(analysisResults || {}),
        csv: result.csv_analysis,
        pdf: result.pdf_analysis,
        model: result.model_analysis,
        modelInfo: result.model_info,
    };
}

function displayResults() {
    resultsContainer.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'result-card';

    const modelSummary = analysisResults?.model?.prediction_summary;
    const modelEval = analysisResults?.model?.evaluation;
    const schema = analysisResults?.model?.schema_check;
    const preview = analysisResults?.model?.prediction_preview;
    const topicAlignment = analysisResults?.model?.topic_alignment;
    let details = `${uploadedFiles.length} file(s) analyzed successfully`;

    if (modelSummary) {
        details += `<br>Predictions: ${modelSummary.count}`;
        if (typeof modelSummary.mean === 'number') {
            details += `<br>Prediction mean: ${modelSummary.mean.toFixed(3)}`;
        }
    }
    if (modelEval && !modelEval.error) {
        details += `<br>Evaluation type: ${modelEval.task_type}`;
    }
    if (schema) {
        details += `<br>Compatibility: ${((schema.compatibility_score || 0) * 100).toFixed(1)}%`;
    }
    if (preview && typeof preview.high_risk_count === 'number') {
        details += `<br>High-risk rows: ${preview.high_risk_count}/${preview.total_rows || 0}`;
    }
    if (topicAlignment) {
        details += `<br>Topic alignment: ${topicAlignment.status} (${((topicAlignment.score || 0) * 100).toFixed(1)}%)`;
    }

    card.innerHTML = `
        <h3>✅ Analysis Complete</h3>
        <div class="content-box">${details}</div>
    `;
    resultsContainer.appendChild(card);
}

function showTopicMismatchPopup() {
    const popupInsight = analysisResults?.model?.popup_insight;
    if (!popupInsight || !popupInsight.show_popup || insightPopupShown) return;

    const existing = document.getElementById('topicInsightPopup');
    if (existing) existing.remove();

    const severityColor = popupInsight.severity === 'high' ? '#b91c1c' : (popupInsight.severity === 'medium' ? '#b45309' : '#065f46');
    const actionsHtml = (popupInsight.actions || []).slice(0, 2)
        .map((item) => `<li style="margin-bottom:4px;">${item}</li>`)
        .join('');

    const wrapper = document.createElement('div');
    wrapper.id = 'topicInsightPopup';
    wrapper.style.position = 'fixed';
    wrapper.style.top = '10px';
    wrapper.style.left = '10px';
    wrapper.style.right = '10px';
    wrapper.style.zIndex = '9999';
    wrapper.style.background = '#ffffff';
    wrapper.style.border = `2px solid ${severityColor}`;
    wrapper.style.borderRadius = '8px';
    wrapper.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
    wrapper.style.padding = '10px';
    wrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="color:${severityColor}; font-size:12px;">${popupInsight.title}</strong>
            <button id="topicInsightCloseBtn" style="border:none; background:transparent; cursor:pointer; font-size:14px;">x</button>
        </div>
        <p style="margin:0 0 6px 0; font-size:11px; color:#374151;">${popupInsight.message}</p>
        ${actionsHtml ? `<ul style="margin:0; padding-left:16px; font-size:10px; color:#4b5563;">${actionsHtml}</ul>` : ''}
    `;

    document.body.appendChild(wrapper);
    const closeBtn = document.getElementById('topicInsightCloseBtn');
    closeBtn?.addEventListener('click', () => wrapper.remove());
    insightPopupShown = true;
}

window.addEventListener('load', checkBackend);
