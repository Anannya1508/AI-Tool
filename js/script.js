// ========================================
// Insightalysis AI - Frontend Logic
// ========================================

const API_URL = 'http://127.0.0.1:5000';

// State
let uploadedFiles = [];
let uploadedModel = null;
let selectedAnalysisType = 'auto';
let analysisResults = null;
let insightPopupShown = false;
let currentChart = null;

// DOM Elements
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const uploadArea = $('#uploadArea');
const fileInput = $('#fileInput');
const fileList = $('#fileList');
const analysisSection = $('#analysisSection');
const modelUploadArea = $('#modelUploadArea');
const modelInput = $('#modelInput');
const modelList = $('#modelList');
const modelStatus = $('#modelStatus');
const targetColumnInput = $('#targetColumnInput');
const themeToggleBtn = $('#themeToggle');
const sidebarToggle = $('#sidebarToggleTopbar');
const sidebar = $('#sidebar');
const mobileMenu = $('#mobileMenu');
const emptyState = $('#emptyState');
const loadingState = $('#loadingState');
const resultsContainer = $('#results');
const progressFill = $('#progressFill');
const progressSteps = $('#progressSteps');
const loadingStep = $('#loadingStep');
const toastContainer = $('#toastContainer');
const analyzeBtn = $('#analyzeBtn');

// ========================================
// Toast System
// ========================================
function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
        error: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
        info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;
    toastContainer.appendChild(toast);
    if (duration > 0) {
        setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 200); }, duration);
    }
}

// ========================================
// Theme Toggle
// ========================================
const savedTheme = localStorage.getItem('insightalysisTheme');
if (savedTheme === 'light') document.body.classList.add('light');

themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('insightalysisTheme', document.body.classList.contains('light') ? 'light' : 'dark');
    if (currentChart) { currentChart.destroy(); currentChart = null; drawChart(); }
});

// ========================================
// Sidebar Toggle
// ========================================
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const icon = sidebarToggle.querySelector('svg');
    icon.style.transform = sidebar.classList.contains('collapsed') ? 'rotate(180deg)' : '';
});

mobileMenu.addEventListener('click', () => sidebar.classList.toggle('open'));

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) && e.target !== mobileMenu) {
        sidebar.classList.remove('open');
    }
});

// ========================================
// Drag & Drop
// ========================================
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

[uploadArea, modelUploadArea].forEach(area => {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        area.addEventListener(evt, preventDefaults, false);
    });
});

uploadArea.addEventListener('dragenter', () => uploadArea.classList.add('drag-over'));
uploadArea.addEventListener('dragover', () => uploadArea.classList.add('drag-over'));
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => { uploadArea.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });

modelUploadArea.addEventListener('dragenter', () => modelUploadArea.classList.add('drag-over'));
modelUploadArea.addEventListener('dragover', () => modelUploadArea.classList.add('drag-over'));
modelUploadArea.addEventListener('dragleave', () => modelUploadArea.classList.remove('drag-over'));
modelUploadArea.addEventListener('drop', (e) => { modelUploadArea.classList.remove('drag-over'); handleModelFile(e.dataTransfer.files); });

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
modelInput.addEventListener('change', (e) => handleModelFile(e.target.files));
uploadArea.addEventListener('click', (e) => {
    if (e.target === uploadArea || e.target.closest('.upload-icon') || e.target.classList.contains('upload-text')) {
        fileInput.click();
    }
});

// ========================================
// File Handling
// ========================================
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIconClass(name) {
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.pkl')) return 'pkl';
    return 'csv';
}

function getFileIcon(name) {
    if (name.endsWith('.csv')) return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>';
    if (name.endsWith('.pdf')) return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
}

function handleFiles(files) {
    const arr = Array.from(files);
    const valid = arr.filter(f => f.name.endsWith('.csv') || f.name.endsWith('.pdf'));
    if (valid.length === 0) { showToast('Please select a .csv or .pdf file', 'error'); return; }
    uploadedFiles = valid;
    displayFileList();
    updateTopbar();
}

function displayFileList() {
    fileList.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-info">
                <div class="file-icon ${getFileIconClass(file.name)}">${getFileIcon(file.name)}</div>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">${file.name.split('.').pop().toUpperCase()} &middot; ${formatSize(file.size)}</div>
                </div>
            </div>
            <button class="btn-remove" onclick="removeFile(${index})" aria-label="Remove file">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        `;
        fileList.appendChild(item);
    });
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    displayFileList();
    updateTopbar();
}

function handleModelFile(files) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.pkl')) { showToast('Only .pkl model files allowed', 'error'); return; }
    uploadedModel = file;
    displayModelFile();
    uploadModelToBackend();
}

function displayModelFile() {
    modelList.innerHTML = '';
    if (!uploadedModel) return;
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
        <div class="file-info">
            <div class="file-icon pkl">${getFileIcon(uploadedModel.name)}</div>
            <div>
                <div class="file-name">${uploadedModel.name}</div>
                <div class="file-meta">ML Model &middot; ${formatSize(uploadedModel.size)}</div>
            </div>
        </div>
        <button class="btn-remove" onclick="removeModel()" aria-label="Remove model">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;
    modelList.appendChild(item);
}

function removeModel() {
    uploadedModel = null;
    displayModelFile();
    modelStatus.hidden = true;
}

// ========================================
// Model Upload
// ========================================
async function uploadModelToBackend() {
    if (!uploadedModel) return;
    try {
        const formData = new FormData();
        formData.append('model_file', uploadedModel);
        modelStatus.hidden = false;
        modelStatus.className = 'model-status loading';
        modelStatus.textContent = 'Uploading model...';
        const response = await fetch(`${API_URL}/upload-model`, { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
            modelStatus.className = 'model-status success';
            modelStatus.innerHTML = `<strong>${result.message}</strong><br>Type: ${result.model_info.model_type} &middot; Ready`;
            showToast('Model loaded successfully', 'success');
        } else { throw new Error(result.error || 'Upload failed'); }
    } catch (error) {
        modelStatus.className = 'model-status error';
        modelStatus.textContent = error.message;
        showToast('Model upload failed: ' + error.message, 'error');
    }
}

// ========================================
// Analysis Type
// ========================================
$$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedAnalysisType = btn.dataset.type;
    });
});

// ========================================
// Analysis Trigger
// ========================================
analyzeBtn.addEventListener('click', () => analyzeFiles());

async function analyzeFiles() {
    if (isAnalyzing) return;
    if (uploadedFiles.length === 0) { showToast('Please upload files first', 'error'); return; }
    isAnalyzing = true;
    emptyState.hidden = true;
    resultsContainer.hidden = true;
    loadingState.hidden = false;
    analyzeBtn.disabled = true;
    analysisResults = null;
    insightPopupShown = false;
    chartSelection = { feature: null, chartType: 'histogram', scatterY: null };
    if (currentChart) { currentChart.destroy(); currentChart = null; }
    if (displayResultsTimer) { clearTimeout(displayResultsTimer); displayResultsTimer = null; }
    updateProgress(0, 'upload');

    try {
        await ensureBackendAvailable();
        const hasCSV = uploadedFiles.some(f => f.name.endsWith('.csv'));
        const hasPDF = uploadedFiles.some(f => f.name.endsWith('.pdf'));
        const hasModel = uploadedFiles.some(f => f.name.endsWith('.pkl')) || !!uploadedModel;
        updateProgress(15, 'extract');

        if (selectedAnalysisType === 'combined') {
            if (!hasCSV) throw new Error('Combined analysis requires at least a CSV file.');
            await analyzeCombined();
        } else if (selectedAnalysisType === 'auto') {
            if (hasCSV) { hasModel ? await analyzeCSVWithModel() : await analyzeCSVFile(); }
            if (hasPDF) await analyzePDFFile();
        } else if (selectedAnalysisType === 'csv') {
            if (!hasCSV) throw new Error('CSV file not found.');
            hasModel ? await analyzeCSVWithModel() : await analyzeCSVFile();
        } else if (selectedAnalysisType === 'pdf') {
            if (!hasPDF) throw new Error('PDF file not found.');
            await analyzePDFFile();
        }

        updateProgress(75, 'analyze');
        await sleep(300);
        updateProgress(90, 'render');
        displayResults();
        showTopicMismatchPopup();
        updateProgress(100, 'render');
        showToast('Analysis complete', 'success');
    } catch (error) {
        console.error('Analysis error:', error);
        showToast(error.message, 'error');
        showEmptyState();
    } finally {
        loadingState.hidden = true;
        analyzeBtn.disabled = false;
        isAnalyzing = false;
    }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function updateProgress(percent, step) {
    progressFill.style.width = percent + '%';
    $$('.step').forEach(s => {
        s.classList.remove('active', 'done');
        if (s.dataset.step === step) s.classList.add('active');
        const steps = ['upload', 'extract', 'analyze', 'render'];
        if (steps.indexOf(s.dataset.step) < steps.indexOf(step)) s.classList.add('done');
    });
    const stepLabels = { upload: 'Uploading files...', extract: 'Extracting data...', analyze: 'Running analysis...', render: 'Rendering results...' };
    loadingStep.textContent = stepLabels[step] || 'Processing...';
}

function updateTopbar() {
    const mode = $('#topbarMode');
    if (uploadedFiles.length === 0) { mode.textContent = 'Ready to analyze'; }
    else {
        const names = uploadedFiles.map(f => f.name).join(', ');
        mode.textContent = names.length > 40 ? names.substring(0, 40) + '...' : names;
    }
}

function showEmptyState() {
    emptyState.hidden = false;
    loadingState.hidden = true;
    resultsContainer.hidden = true;
}

async function ensureBackendAvailable() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (!response.ok) throw new Error('Backend unhealthy');
    } catch { throw new Error('Backend unreachable. Run the backend server first (python backend/app.py).'); }
}

// ========================================
// API Calls
// ========================================
async function analyzeCSVFile() {
    const csvFile = uploadedFiles.find(f => f.name.endsWith('.csv'));
    if (!csvFile) throw new Error('CSV file not found.');
    const formData = new FormData();
    formData.append('file', csvFile);
    const response = await fetch(`${API_URL}/analyze-csv`, { method: 'POST', body: formData });
    if (!response.ok) { const text = await response.text(); throw new Error(`CSV analysis failed: ${text}`); }
    const result = await response.json();
    analysisResults = { ...(analysisResults || {}), csv: result.analysis };
}

async function analyzePDFFile() {
    const pdfFile = uploadedFiles.find(f => f.name.endsWith('.pdf'));
    if (!pdfFile) throw new Error('PDF file not found.');
    const formData = new FormData();
    formData.append('file', pdfFile);
    const response = await fetch(`${API_URL}/analyze-pdf`, { method: 'POST', body: formData });
    if (!response.ok) { const text = await response.text(); throw new Error(`PDF analysis failed: ${text}`); }
    const result = await response.json();
    analysisResults = { ...(analysisResults || {}), pdf: result.analysis };
}

async function analyzeCSVWithModel() {
    const csvFile = uploadedFiles.find(f => f.name.endsWith('.csv'));
    if (!csvFile) throw new Error('CSV file not found.');
    if (!uploadedModel) throw new Error('Model file not selected.');
    const formData = new FormData();
    formData.append('dataset_file', csvFile);
    formData.append('model_file', uploadedModel);
    const targetColumn = targetColumnInput?.value.trim();
    if (targetColumn) formData.append('target_column', targetColumn);
    const response = await fetch(`${API_URL}/analyze-with-model`, { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'CSV + model analysis failed');
    analysisResults = { ...(analysisResults || {}), csv: result.analysis, model: result.model_analysis, modelInfo: result.model_info };
}

async function analyzeCombined() {
    const formData = new FormData();
    let hasCSV = false;
    uploadedFiles.forEach(file => {
        if (file.name.endsWith('.csv')) { formData.append('csv_file', file); hasCSV = true; }
        if (file.name.endsWith('.pdf')) formData.append('pdf_file', file);
    });
    if (!hasCSV) throw new Error('Combined analysis requires a CSV file.');
    if (uploadedModel) formData.append('model_file', uploadedModel);
    const targetColumn = targetColumnInput?.value.trim();
    if (targetColumn) formData.append('target_column', targetColumn);
    const response = await fetch(`${API_URL}/analyze-combined`, { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Combined analysis failed');
    analysisResults = { ...(analysisResults || {}), csv: result.csv_analysis, pdf: result.pdf_analysis, model: result.model_analysis, modelInfo: result.model_info };
}

// ========================================
// Results Display
// ========================================
function displayResults() {
    resultsContainer.innerHTML = '';
    emptyState.hidden = true;
    loadingState.hidden = true;
    resultsContainer.hidden = false;

    const topbarActions = document.getElementById('topbarActions');
    if (topbarActions) topbarActions.hidden = false;

    if (analysisResults?.csv || analysisResults?.pdf) resultsContainer.appendChild(buildSummaryCard());
    const insights = collectInsights();
    if (insights.length > 0) resultsContainer.appendChild(buildInsightsCard(insights));
    resultsContainer.appendChild(buildDataCard());
    if (analysisResults?.csv) resultsContainer.appendChild(buildChartCard());
    if (analysisResults?.model) resultsContainer.appendChild(buildModelCard());
    if (analysisResults?.csv?.followup_ideas?.recommendations) resultsContainer.appendChild(buildRecommendationsCard());
    resultsContainer.appendChild(buildQuestionsCard());
    resultsContainer.appendChild(buildNextStepsCard());

    if (displayResultsTimer) { clearTimeout(displayResultsTimer); displayResultsTimer = null; }
    displayResultsTimer = setTimeout(() => {
        if (analysisResults?.csv) { try { setupChartControls(); drawChart(); } catch (e) { console.error('Chart render failed:', e); } }
    }, 100);
}

function buildCard(title, iconClass, iconSvg, bodyContent, id) {
    const card = document.createElement('div');
    card.className = 'result-card';
    if (id) card.id = id;
    card.innerHTML = `
        <div class="card-header">
            <div class="card-icon ${iconClass}">${iconSvg}</div>
            <div class="card-title">${title}</div>
            <svg class="card-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="card-body">${bodyContent}</div>
    `;
    card.querySelector('.card-header').addEventListener('click', () => card.classList.toggle('collapsed'));
    return card;
}

function buildSummaryCard() {
    const files = uploadedFiles.map(f => f.name).join(', ');
    let summary = `<p>You uploaded ${uploadedFiles.length} file(s): <strong>${files}</strong></p>`;
    if (analysisResults?.csv) summary += '<p style="margin-top:6px;">CSV data analysis complete.</p>';
    if (analysisResults?.pdf) summary += '<p style="margin-top:6px;">PDF document analysis complete.</p>';
    if (analysisResults?.model) summary += '<p style="margin-top:6px;">ML model evaluation complete.</p>';
    return buildCard('Summary', 'summary', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>', summary);
}

function collectInsights() {
    const insights = [];
    if (analysisResults?.csv?.overview) {
        const o = analysisResults.csv.overview;
        insights.push({ text: `${o.rows} rows, ${o.columns} columns`, type: 'info' });
        insights.push({ text: `Columns: ${o.column_names.join(', ')}`, type: 'info' });
    }
    if (analysisResults?.csv?.missing_values) {
        const miss = analysisResults.csv.missing_values;
        const cols = Object.entries(miss.missing_counts).filter(([, v]) => v > 0);
        if (cols.length > 0) insights.push({ text: `Missing values in: ${cols.map(([k]) => k).join(', ')}`, type: 'warning' });
        else insights.push({ text: 'No missing values detected', type: 'success' });
    }
    if (analysisResults?.pdf?.summary) insights.push({ text: `PDF: ${analysisResults.pdf.summary.page_count} pages analyzed`, type: 'info' });
    if (analysisResults?.model?.prediction_summary) {
        const pred = analysisResults.model.prediction_summary;
        insights.push({ text: `Model generated ${pred.count} predictions`, type: 'info' });
    }
    if (analysisResults?.model?.schema_check) {
        const score = (analysisResults.model.schema_check.compatibility_score || 0) * 100;
        insights.push({ text: `Dataset-model compatibility: ${score.toFixed(1)}%`, type: score > 80 ? 'success' : 'warning' });
    }
    if (analysisResults?.model?.risk_alerts?.length) {
        analysisResults.model.risk_alerts.forEach(a => insights.push({ text: a, type: 'danger' }));
    }
    return insights;
}

function buildInsightsCard(insights) {
    const html = '<ul class="insight-list">' + insights.map(i =>
        `<li class="insight-item"><span class="insight-dot ${i.type}"></span><span>${i.text}</span></li>`
    ).join('') + '</ul>';
    return buildCard('Key Insights', 'insights', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>', html);
}

function buildDataCard() {
    let content = '';
    if (analysisResults?.csv) {
        content += `<div class="data-block"><div class="data-block-header"><span class="data-block-title">CSV Overview</span><button class="btn-copy" onclick="copyData(this)">Copy</button></div><pre>${JSON.stringify(analysisResults.csv.overview, null, 2)}</pre></div>`;
    }
    if (analysisResults?.model) {
        const model = analysisResults.model;
        const compat = ((model.schema_check?.compatibility_score || 0) * 100).toFixed(1);
        content += `<div style="margin-top:12px;padding:12px;background:var(--bg-tertiary);border:1px solid var(--surface-border);border-radius:var(--radius-md);">`;
        content += `<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Model Analysis</div>`;
        content += `<div class="stat-grid" style="margin-bottom:12px;">`;
        content += `<div class="stat-item"><div class="stat-value">${compat}%</div><div class="stat-label">Compatibility</div></div>`;
        content += `<div class="stat-item"><div class="stat-value">${(model.used_features || []).length}</div><div class="stat-label">Features Used</div></div>`;
        content += `<div class="stat-item"><div class="stat-value">${model.prediction_preview?.high_risk_count || 0}</div><div class="stat-label">High Risk Rows</div></div>`;
        content += `</div>`;
        if (model.evaluation && !model.evaluation.error) {
            const ev = model.evaluation;
            const isRegression = ev.task_type === 'regression';
            content += `<div style="margin-top:12px;padding:12px;background:var(--bg-tertiary);border:1px solid var(--surface-border);border-radius:var(--radius-md);">`;
            content += `<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Model Evaluation</div>`;
            content += `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">Task Type: ${isRegression ? 'Regression' : 'Classification'}</div>`;
            content += `<div class="stat-grid">`;
            if (isRegression) {
                content += `<div class="stat-item"><div class="stat-value">${ev.mae?.toFixed(3) || 'N/A'}</div><div class="stat-label">MAE</div></div>`;
                content += `<div class="stat-item"><div class="stat-value">${ev.rmse?.toFixed(3) || 'N/A'}</div><div class="stat-label">RMSE</div></div>`;
                content += `<div class="stat-item"><div class="stat-value">${ev.r2?.toFixed(3) || 'N/A'}</div><div class="stat-label">R² Score</div></div>`;
            } else {
                content += `<div class="stat-item"><div class="stat-value">${(ev.accuracy * 100)?.toFixed(1) || 'N/A'}%</div><div class="stat-label">Accuracy</div></div>`;
                content += `<div class="stat-item"><div class="stat-value">${(ev.precision_weighted * 100)?.toFixed(1) || 'N/A'}%</div><div class="stat-label">Precision</div></div>`;
                content += `<div class="stat-item"><div class="stat-value">${(ev.recall_weighted * 100)?.toFixed(1) || 'N/A'}%</div><div class="stat-label">Recall</div></div>`;
                content += `<div class="stat-item"><div class="stat-value">${(ev.f1_weighted * 100)?.toFixed(1) || 'N/A'}%</div><div class="stat-label">F1 Score</div></div>`;
            }
            content += `</div></div>`;
        }
        if (model.feature_importance?.length) {
            content += `<div style="margin-top:10px;"><div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">TOP FEATURE DRIVERS</div><ul class="insight-list">`;
            model.feature_importance.slice(0, 5).forEach(f => { content += `<li class="insight-item"><span class="insight-dot"></span><span>${f.feature}: ${Number(f.abs_importance).toFixed(4)}</span></li>`; });
            content += `</ul></div>`;
        }
        content += `</div>`;
    }
    if (analysisResults?.pdf) {
        const pdf = analysisResults.pdf;
        const keyConcepts = Array.isArray(pdf.key_concepts) ? pdf.key_concepts : pdf.key_concepts?.key_concepts || pdf.key_concepts?.keywords || [];
        content += `<div style="margin-top:12px;padding:12px;background:var(--bg-tertiary);border:1px solid var(--surface-border);border-radius:var(--radius-md);">`;
        content += `<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">PDF Summary</div>`;
        content += `<p style="margin:0;color:var(--text-secondary);">${pdf.summary?.summary || 'No summary available'}</p>`;
        content += `<p style="margin:8px 0 0;font-size:11px;color:var(--text-muted);">Pages: ${pdf.summary?.page_count || 'N/A'} &middot; Paragraphs: ${pdf.summary?.total_paragraphs || 'N/A'}</p>`;
        content += `</div>`;
        if (keyConcepts.length > 0) content += `<div style="margin-top:8px;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--surface-border);border-radius:var(--radius-md);"><div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">KEY CONCEPTS</div><p style="margin:0;font-size:12px;color:var(--text-secondary);">${keyConcepts.join(', ')}</p></div>`;
        if (analysisResults.pdf.headings?.headings?.length) content += `<div style="margin-top:8px;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--surface-border);border-radius:var(--radius-md);"><div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">DETECTED HEADINGS</div><ul style="margin:0;padding-left:16px;font-size:12px;color:var(--text-secondary);">${analysisResults.pdf.headings.headings.map(h => `<li>${h}</li>`).join('')}</ul></div>`;
        if (analysisResults.pdf.references) {
            const refs = analysisResults.pdf.references;
            content += `<div style="margin-top:8px;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--surface-border);border-radius:var(--radius-md);"><div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">REFERENCES</div>`;
            (refs.books || []).forEach(b => { content += `<p style="margin:2px 0;font-size:12px;"><a href="${b.link}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;">${b.title}</a></p>`; });
            (refs.resources || []).forEach(r => { content += `<p style="margin:2px 0;font-size:12px;"><a href="${r.link}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;">${r.name || r}</a></p>`; });
            content += `</div>`;
        }
    }
    if (!content) content = '<p style="color:var(--text-muted);">No detailed data available.</p>';
    return buildCard('Data & Analysis', 'data', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>', content);
}

function buildChartCard() {
    const content = `<div class="chart-wrapper"><div class="chart-controls" id="chartControls"></div><div class="chart-canvas" style="position:relative"><canvas id="chartCanvas"></canvas><div id="heatmapContainer" style="display:none;overflow-x:auto;width:100%;padding:8px;"></div></div><div class="chart-stats" id="chartStats"></div></div>`;
    return buildCard('Visualizations', 'charts', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>', content, 'chartSection');
}

function buildModelCard() {
    const model = analysisResults.model;
    let content = '';
    const isClassification = model.evaluation?.task_type === 'classification';
    const totalRows = model.prediction_preview?.total_rows || 0;
    const highRisk = model.prediction_preview?.high_risk_count || 0;
    const compat = ((model.schema_check?.compatibility_score || 0) * 100).toFixed(1);

    content += `<p style="margin-bottom:12px;font-size:12px;color:var(--text-secondary);line-height:1.6;">`;
    content += `Compares your dataset's <strong>actual</strong> values against the model's <strong>predicted</strong> values. `;
    content += `<strong>Error</strong> = |Actual &minus; Predicted|. `;
    content += `<span style="color:var(--danger);font-weight:600;">High</span> risk rows have errors above the 80th percentile threshold.`;
    content += `</p>`;

    content += `<div class="stat-grid" style="margin-bottom:12px;">`;
    content += `<div class="stat-item"><div class="stat-value">${compat}%</div><div class="stat-label">Compatibility</div></div>`;
    content += `<div class="stat-item"><div class="stat-value">${totalRows}</div><div class="stat-label">Total Rows</div></div>`;
    content += `<div class="stat-item"><div class="stat-value" style="color:var(--danger)">${highRisk}</div><div class="stat-label">High Risk</div></div>`;
    if (model.evaluation && !model.evaluation.error) {
        if (isClassification) {
            content += `<div class="stat-item"><div class="stat-value">${((model.evaluation.f1_weighted || 0) * 100).toFixed(1)}%</div><div class="stat-label">F1 Score</div></div>`;
        } else if (model.evaluation.r2 !== undefined) {
            content += `<div class="stat-item"><div class="stat-value">${(model.evaluation.r2 || 0).toFixed(3)}</div><div class="stat-label">R&sup2;</div></div>`;
        }
    }
    content += `</div>`;

    if (model.prediction_preview?.rows?.length) {
        content += '<div style="overflow-x:auto;"><table class="heatmap-table"><thead><tr><th>Row</th><th>Actual</th><th>Predicted</th><th>Error</th><th>Risk</th></tr></thead><tbody>';
        model.prediction_preview.rows.slice(0, 8).forEach(row => {
            const riskClass = row.risk === 'high' ? 'danger' : 'success';
            content += `<tr><td>${row.row_index}</td><td>${row.actual ?? '-'}</td><td>${row.predicted}</td><td>${row.abs_error ?? '-'}</td><td><span style="color:var(--${riskClass});font-weight:600;">${row.risk === 'high' ? 'High' : 'Normal'}</span></td></tr>`;
        });
        content += '</tbody></table></div>';
    }
    if (model.risk_alerts?.length) {
        content += `<div style="margin-top:12px;"><ul class="insight-list">`;
        model.risk_alerts.forEach(a => { content += `<li class="insight-item"><span class="insight-dot danger"></span><span>${a}</span></li>`; });
        content += `</ul></div>`;
    }
    return buildCard('ML Predictions', 'model', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93a1 1 0 00-.75.97V13"/><circle cx="12" cy="17" r="1"/></svg>', content);
}

function buildRecommendationsCard() {
    const recs = analysisResults.csv.followup_ideas.recommendations;
    if (!recs?.length) return document.createElement('div');

    let content = '<div class="rec-list">';
    recs.forEach(r => {
        content += `<div class="rec-item">
            <div class="rec-type">${r.type}</div>
            <p class="rec-reason">${r.reason}</p>
            <div class="rec-algos">${r.algorithms.map(a => `<span class="algo-tag">${a}</span>`).join('')}</div>
        </div>`;
    });
    content += '</div>';

    return buildCard('Recommended Techniques', 'next', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 12l2 2 4-4"/></svg>', content);
}

function buildQuestionsCard() {
    const questions = getAllQuestions();
    let content = '';
    if (questions.length > 0) {
        questions.forEach(q => {
            content += `<div class="question-item"><div class="question-text">${q.question}</div><div class="question-options">`;
            q.options.forEach((opt, i) => {
                content += `<button class="option-btn" data-q="${q.id}" data-index="${i}" onclick="checkAnswer(this, ${q.correctIndex})">${opt}</button>`;
            });
            content += `<div class="question-feedback" id="feedback-${q.id}"></div></div></div>`;
        });
    } else {
        content = '<p style="color:var(--text-muted);">No practice questions generated.</p>';
    }
    return buildCard('Practice Questions', 'questions', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>', content);
}

function buildNextStepsCard() {
    const steps = [];
    if (analysisResults?.csv?.followup_ideas?.ideas) steps.push(...analysisResults.csv.followup_ideas.ideas);
    if (analysisResults?.pdf?.recommendations?.next_steps) steps.push(...analysisResults.pdf.recommendations.next_steps);
    if (steps.length === 0) {
        steps.push('Validate findings with domain knowledge');
        steps.push('Try different model algorithms');
        steps.push('Check for overfitting on small datasets');
    }
    const html = '<ul class="insight-list">' + steps.map(s => `<li class="insight-item"><span class="insight-dot success"></span><span>${s}</span></li>`).join('') + '</ul>';
    return buildCard('Next Steps', 'next', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>', html);
}

// ========================================
// Question Handling (Backend-driven)
// ========================================
function getAllQuestions() {
    const allQuestions = [];
    const csv = analysisResults?.csv;
    const pdf = analysisResults?.pdf;

    if (csv?.questions?.length) {
        csv.questions.forEach((q, i) => {
            allQuestions.push({ id: `csv_${q.id || i}`, question: q.question, options: q.options, correctIndex: q.correctIndex });
        });
    }

    if (pdf?.questions?.questions?.length) {
        pdf.questions.questions.forEach((q, i) => {
            if (typeof q === 'string') {
                allQuestions.push({ id: `pdf_${i}`, question: q, options: ['True', 'False'], correctIndex: 0 });
            } else {
                allQuestions.push({ id: `pdf_${q.id || i}`, question: q.question || q, options: q.options || ['True', 'False'], correctIndex: q.correctIndex || 0 });
            }
        });
    }

    if (allQuestions.length === 0) {
        allQuestions.push({
            id: 'default_1', question: 'What should you do first before model training?',
            options: ['Analyze missing values', 'Deploy immediately', 'Ignore correlations', 'Delete dataset'],
            correctIndex: 0
        });
    }

    return allQuestions;
}

window.checkAnswer = function(btn, correctIndex) {
    const qid = btn.getAttribute('data-q');
    const choice = Number(btn.getAttribute('data-index'));
    const feedback = document.getElementById(`feedback-${qid}`);
    const parent = btn.closest('.question-item');
    const allBtns = parent.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);
    if (choice === correctIndex) {
        btn.classList.add('correct');
        feedback.innerHTML = '<span style="color:var(--success);font-weight:600;">Correct!</span>';
    } else {
        btn.classList.add('wrong');
        allBtns[correctIndex].classList.add('correct');
        feedback.innerHTML = '<span style="color:var(--danger);font-weight:600;">Incorrect</span>';
    }
};

// ========================================
// Prediction
// ========================================
window.copyData = function(btn) {
    const pre = btn.closest('.data-block').querySelector('pre');
    if (pre) {
        navigator.clipboard.writeText(pre.textContent).then(() => { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); });
    }
};

// ========================================
// Chart.js Charts
// ========================================
let chartSelection = { feature: null, chartType: 'histogram', scatterY: null };
let displayResultsTimer = null;
let isAnalyzing = false;

function getNumericFields() {
    if (!analysisResults?.csv?.sample_rows) return [];
    const sample = analysisResults.csv.sample_rows;
    if (!sample.length) return [];
    return Object.keys(sample[0]).filter(k => typeof sample[0][k] === 'number');
}

function computeStats(values) {
    const arr = values.filter(v => !Number.isNaN(v)).sort((a, b) => a - b);
    if (!arr.length) return null;
    const sum = arr.reduce((a, b) => a + b, 0);
    const mean = sum / arr.length;
    const median = arr.length % 2 === 0 ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2 : arr[Math.floor(arr.length / 2)];
    const q1 = arr[Math.floor(arr.length * 0.25)];
    const q3 = arr[Math.floor(arr.length * 0.75)];
    return { min: arr[0], max: arr[arr.length - 1], mean, median, q1, q3 };
}

function setupChartControls() {
    const controls = document.getElementById('chartControls');
    if (!controls) return;
    controls.innerHTML = '';
    const numericFields = getNumericFields();
    if (!numericFields.length) { controls.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No numeric columns available</span>'; return; }
    if (!numericFields.includes(chartSelection.feature)) chartSelection.feature = numericFields[0];
    if (!numericFields.includes(chartSelection.scatterY)) chartSelection.scatterY = numericFields.length > 1 ? numericFields[1] : numericFields[0];

    const fieldSelect = document.createElement('select');
    numericFields.forEach(f => { const opt = document.createElement('option'); opt.value = f; opt.textContent = f; if (f === chartSelection.feature) opt.selected = true; fieldSelect.appendChild(opt); });

    const typeSelect = document.createElement('select');
    ['histogram', 'pie', 'line', 'scatter', 'box', 'heatmap'].forEach(type => {
        const opt = document.createElement('option'); opt.value = type; opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        if (type === chartSelection.chartType) opt.selected = true;
        typeSelect.appendChild(opt);
    });

    const scatterSelect = document.createElement('select');
    scatterSelect.id = 'chartScatterY';
    numericFields.forEach(f => { const opt = document.createElement('option'); opt.value = f; opt.textContent = f; if (f === chartSelection.scatterY) opt.selected = true; scatterSelect.appendChild(opt); });

    fieldSelect.addEventListener('change', () => { chartSelection.feature = fieldSelect.value; drawChart(); });
    typeSelect.addEventListener('change', () => { chartSelection.chartType = typeSelect.value; scatterSelect.style.display = chartSelection.chartType === 'scatter' ? '' : 'none'; drawChart(); });
    scatterSelect.addEventListener('change', () => { chartSelection.scatterY = scatterSelect.value; drawChart(); });

    controls.append(fieldSelect, typeSelect, scatterSelect);
    scatterSelect.style.display = chartSelection.chartType === 'scatter' ? '' : 'none';
}

function drawChart() {
    const canvas = document.getElementById('chartCanvas');
    const heatmapContainer = document.getElementById('heatmapContainer');
    const statsEl = document.getElementById('chartStats');
    if (!canvas || !statsEl) return;

    if (currentChart) { currentChart.destroy(); currentChart = null; }
    statsEl.innerHTML = '';
    if (heatmapContainer) { heatmapContainer.style.display = 'none'; heatmapContainer.innerHTML = ''; }
    canvas.style.display = '';

    if (!analysisResults?.csv) return;
    const rows = analysisResults.csv.sample_rows || [];
    const field = chartSelection.feature;
    if (!field) return;

    const rawValues = rows.map(r => Number(r[field])).filter(v => !Number.isNaN(v));
    if (!rawValues.length) return;

    const data = rawValues;
    const stats = computeStats(data);
    if (!stats) return;

    const isDark = !document.body.classList.contains('light');
    const textColor = isDark ? '#9898a8' : '#5a5a72';
    const gridColor = isDark ? '#2a2a3a' : '#e2e3ea';

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 280;

    if (chartSelection.chartType === 'histogram') {
        const bins = 8;
        const width = stats.max - stats.min || 1;
        const edges = Array.from({ length: bins + 1 }, (_, i) => stats.min + i * width / bins);
        const counts = Array(bins).fill(0);
        data.forEach(v => { const i = Math.min(bins - 1, Math.floor(((v - stats.min) / width) * bins)); counts[i] += 1; });

        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: edges.slice(0, -1).map((e, i) => `${e.toFixed(1)}-${edges[i + 1].toFixed(1)}`),
                datasets: [{ label: 'Frequency', data: counts, backgroundColor: 'rgba(129, 140, 248, 0.6)', borderColor: 'rgba(129, 140, 248, 1)', borderWidth: 1, borderRadius: 4 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true }
                }
            }
        });

    } else if (chartSelection.chartType === 'pie') {
        const bins = 6;
        const width = stats.max - stats.min || 1;
        const edges = Array.from({ length: bins + 1 }, (_, i) => stats.min + i * width / bins);
        const counts = Array(bins).fill(0);
        data.forEach(v => { const i = Math.min(bins - 1, Math.floor(((v - stats.min) / width) * bins)); counts[i] += 1; });

        const pieColors = [
            'rgba(129, 140, 248, 0.8)', 'rgba(6, 182, 212, 0.8)',
            'rgba(251, 191, 36, 0.8)', 'rgba(52, 211, 153, 0.8)',
            'rgba(248, 113, 113, 0.8)', 'rgba(168, 85, 247, 0.8)'
        ];

        currentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: edges.slice(0, -1).map((e, i) => `${e.toFixed(1)}-${edges[i + 1].toFixed(1)}`),
                datasets: [{ data: counts, backgroundColor: pieColors, borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: textColor, font: { size: 11 }, padding: 12 } }
                }
            }
        });

    } else if (chartSelection.chartType === 'line') {
        const allData = rows.map((r, i) => ({ x: i + 1, y: Number(r[field]) })).filter(p => Number.isFinite(p.y));
        const subset = allData.slice(0, 30);
        subset.sort((a, b) => a.x - b.x);

        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: subset.map(p => p.x),
                datasets: [{
                    label: field,
                    data: subset.map(p => p.y),
                    borderColor: 'rgba(129, 140, 248, 1)',
                    backgroundColor: 'rgba(129, 140, 248, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'Row Index', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { title: { display: true, text: field, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });

    } else if (chartSelection.chartType === 'scatter') {
        const yField = chartSelection.scatterY || field;
        const pairs = rows.map(r => ({ x: Number(r[field]), y: Number(r[yField]) })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        const subset = pairs.slice(0, 40);

        currentChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: `${field} vs ${yField}`,
                    data: subset.map(p => ({ x: p.x, y: p.y })),
                    backgroundColor: 'rgba(129, 140, 248, 0.6)',
                    borderColor: 'rgba(129, 140, 248, 1)',
                    pointRadius: 5, pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: field, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { title: { display: true, text: yField, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });

    } else if (chartSelection.chartType === 'box') {
        const fields = getNumericFields();
        const allData = fields.map(f => rows.map(r => Number(r[f])).filter(Number.isFinite));
        const boxData = allData.map(arr => {
            const sorted = arr.sort((a, b) => a - b);
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const median = sorted[Math.floor(sorted.length * 0.5)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            return [sorted[0], q1, median, q3, sorted[sorted.length - 1]];
        });

        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: fields,
                datasets: [
                    { label: 'Min to Q1', data: boxData.map(d => d[1] - d[0]), backgroundColor: 'transparent', borderWidth: 0 },
                    { label: 'Q1 to Median', data: boxData.map(d => d[2] - d[1]), backgroundColor: 'rgba(129, 140, 248, 0.4)', borderColor: 'rgba(129, 140, 248, 0.8)', borderWidth: 1 },
                    { label: 'Median to Q3', data: boxData.map(d => d[3] - d[2]), backgroundColor: 'rgba(129, 140, 248, 0.6)', borderColor: 'rgba(129, 140, 248, 1)', borderWidth: 1 },
                    { label: 'Q3 to Max', data: boxData.map(d => d[4] - d[3]), backgroundColor: 'transparent', borderWidth: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const d = boxData[ctx.dataIndex]; return `Min: ${d[0]?.toFixed(2)}, Q1: ${d[1]?.toFixed(2)}, Med: ${d[2]?.toFixed(2)}, Q3: ${d[3]?.toFixed(2)}, Max: ${d[4]?.toFixed(2)}`; } } } },
                scales: {
                    x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });

    } else if (chartSelection.chartType === 'heatmap') {
        const fields = getNumericFields();
        if (!fields.length) return;
        const values = fields.map(f => rows.map(r => Number(r[f])).filter(Number.isFinite));
        const means = values.map(arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const matrix = fields.map((_, i) => fields.map((_, j) => {
            const xi = values[i], yj = values[j];
            const minLen = Math.min(xi.length, yj.length);
            if (!minLen) return 0;
            let cov = 0, sx = 0, sy = 0;
            for (let k = 0; k < minLen; k++) { const dx = xi[k] - means[i], dy = yj[k] - means[j]; cov += dx * dy; sx += dx * dx; sy += dy * dy; }
            return cov / (Math.sqrt(sx * sy) || 1);
        }));

        let table = '<table class="heatmap-table"><thead><tr><th></th>';
        fields.forEach(name => { table += `<th>${name}</th>`; });
        table += '</tr></thead><tbody>';
        fields.forEach((name, i) => {
            table += `<tr><th>${name}</th>`;
            matrix[i].forEach(val => {
                const p = (val + 1) / 2;
                const r = Math.round(255 * (1 - p));
                const g = Math.round(255 * p);
                table += `<td style="background:rgba(${r},${g},128,0.7);color:#fff;font-weight:500;">${val.toFixed(2)}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody></table>';
        canvas.style.display = 'none';
        heatmapContainer.innerHTML = table;
        heatmapContainer.style.display = 'block';
    }

    statsEl.innerHTML = `min=${stats.min.toFixed(2)} &middot; Q1=${stats.q1.toFixed(2)} &middot; median=${stats.median.toFixed(2)} &middot; Q3=${stats.q3.toFixed(2)} &middot; max=${stats.max.toFixed(2)} &middot; mean=${stats.mean.toFixed(2)}`;
}

// ========================================
// Topic Mismatch Popup
// ========================================
function showTopicMismatchPopup() {
    const popup = analysisResults?.model?.popup_insight;
    if (!popup || !popup.show_popup || insightPopupShown) return;
    showToast(`${popup.title}: ${popup.message}`, popup.severity === 'high' ? 'error' : 'info', 6000);
    insightPopupShown = true;
}

// ========================================
// Export Dropdown Toggle
// ========================================
const exportBtn = document.getElementById('exportBtn');
const exportMenu = document.getElementById('exportMenu');

if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('show');
    });
}

document.addEventListener('click', () => {
    if (exportMenu) exportMenu.classList.remove('show');
});

// ========================================
// Export: PDF Report
// ========================================
window.exportPDF = async function() {
    if (!analysisResults) { showToast('No results to export', 'error'); return; }
    showToast('Generating PDF report...', 'info');

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        // Header
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('Insightalysis AI', 20, 18);
        doc.setFontSize(10);
        doc.text('AI Assistant for Research Paper & Dataset Analysis', 20, 26);
        doc.setFontSize(8);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 34);

        y = 50;
        doc.setTextColor(30, 30, 30);

        // Summary Section
        doc.setFontSize(14);
        doc.text('Summary', 20, y);
        y += 8;
        doc.setFontSize(10);
        const files = uploadedFiles.map(f => f.name).join(', ');
        doc.text(`Files: ${files}`, 20, y);
        y += 6;

        if (analysisResults?.csv?.overview) {
            const o = analysisResults.csv.overview;
            doc.text(`Rows: ${o.rows} | Columns: ${o.columns}`, 20, y);
            y += 6;
            doc.text(`Column Names: ${o.column_names.join(', ')}`, 20, y);
            y += 10;
        }

        if (analysisResults?.pdf?.summary) {
            doc.text(`PDF Pages: ${analysisResults.pdf.summary.page_count}`, 20, y);
            y += 10;
        }

        // Descriptive Stats
        if (analysisResults?.csv?.descriptive_stats) {
            doc.setFontSize(14);
            doc.text('Descriptive Statistics', 20, y);
            y += 8;
            doc.setFontSize(9);
            const stats = analysisResults.csv.descriptive_stats;
            const cols = Object.keys(stats.mean || {}).slice(0, 5);
            cols.forEach(col => {
                const mean = stats.mean[col]?.toFixed(2) ?? '-';
                const median = stats.median[col]?.toFixed(2) ?? '-';
                const std = stats.std_dev[col]?.toFixed(2) ?? '-';
                doc.text(`${col}: Mean=${mean}, Median=${median}, StdDev=${std}`, 20, y);
                y += 5;
                if (y > 270) { doc.addPage(); y = 20; }
            });
            y += 5;
        }

        // Missing Values
        if (analysisResults?.csv?.missing_values) {
            doc.setFontSize(14);
            doc.text('Missing Values', 20, y);
            y += 8;
            doc.setFontSize(9);
            const mv = analysisResults.csv.missing_values;
            Object.entries(mv.missing_counts).forEach(([col, count]) => {
                if (count > 0) {
                    doc.text(`${col}: ${count} missing (${mv.missing_percentage[col]?.toFixed(1)}%)`, 20, y);
                    y += 5;
                    if (y > 270) { doc.addPage(); y = 20; }
                }
            });
            y += 5;
        }

        // Key Insights
        const insights = collectInsights();
        if (insights.length > 0) {
            doc.setFontSize(14);
            doc.text('Key Insights', 20, y);
            y += 8;
            doc.setFontSize(9);
            insights.forEach(item => {
                const text = item.text.length > 80 ? item.text.substring(0, 80) + '...' : item.text;
                doc.text(`• ${text}`, 20, y);
                y += 5;
                if (y > 270) { doc.addPage(); y = 20; }
            });
            y += 5;
        }

        // Recommendations
        if (analysisResults?.csv?.followup_ideas?.recommendations) {
            doc.setFontSize(14);
            doc.text('Recommended Techniques', 20, y);
            y += 8;
            doc.setFontSize(9);
            analysisResults.csv.followup_ideas.recommendations.forEach(rec => {
                doc.text(`${rec.type}: ${rec.algorithms.join(', ')}`, 20, y);
                y += 5;
                if (y > 270) { doc.addPage(); y = 20; }
            });
            y += 5;
        }

        // PDF Summary
        if (analysisResults?.pdf?.summary) {
            doc.setFontSize(14);
            doc.text('PDF Summary', 20, y);
            y += 8;
            doc.setFontSize(9);
            const summaryText = analysisResults.pdf.summary.summary || 'No summary';
            const lines = doc.splitTextToSize(summaryText, pageWidth - 40);
            lines.forEach(line => {
                doc.text(line, 20, y);
                y += 5;
                if (y > 270) { doc.addPage(); y = 20; }
            });
            y += 5;
        }

        // Practice Questions
        const questions = getAllQuestions();
        if (questions.length > 0) {
            doc.setFontSize(14);
            doc.text('Practice Questions', 20, y);
            y += 8;
            doc.setFontSize(9);
            questions.forEach((q, i) => {
                doc.text(`Q${i + 1}: ${q.question}`, 20, y);
                y += 5;
                q.options.forEach((opt, j) => {
                    doc.text(`  ${String.fromCharCode(65 + j)}. ${opt}${j === q.correctIndex ? ' ✓' : ''}`, 25, y);
                    y += 4;
                    if (y > 270) { doc.addPage(); y = 20; }
                });
                y += 3;
            });
        }

        // Capture chart as image
        const canvas = document.getElementById('chartCanvas');
        if (canvas) {
            try {
                const imgData = canvas.toDataURL('image/png');
                doc.addPage();
                doc.setFontSize(14);
                doc.text('Visualization', 20, 20);
                doc.addImage(imgData, 'PNG', 20, 30, pageWidth - 40, 100);
            } catch (e) { console.log('Chart capture failed:', e); }
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Insightalysis AI | Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
        }

        doc.save(`insightalysis-report-${Date.now()}.pdf`);
        showToast('PDF report downloaded', 'success');
    } catch (error) {
        console.error('PDF export error:', error);
        showToast('PDF export failed: ' + error.message, 'error');
    }
};

// ========================================
// Export: CSV
// ========================================
window.exportCSV = function() {
    if (!analysisResults?.csv) { showToast('No CSV data to export', 'error'); return; }

    let csv = '';
    const overview = analysisResults.csv.overview;
    const stats = analysisResults.csv.descriptive_stats;

    // Overview section
    csv += 'Overview\n';
    csv += `Rows,${overview.rows}\n`;
    csv += `Columns,${overview.columns}\n`;
    csv += `Column Names,"${overview.column_names.join('", "')}"\n\n`;

    // Statistics
    if (stats) {
        csv += 'Statistics\n';
        const cols = Object.keys(stats.mean || {});
        csv += `Column,Mean,Median,Min,Max,StdDev\n`;
        cols.forEach(col => {
            csv += `"${col}",${stats.mean[col] ?? ''},${stats.median[col] ?? ''},${stats.min[col] ?? ''},${stats.max[col] ?? ''},${stats.std_dev[col] ?? ''}\n`;
        });
        csv += '\n';
    }

    // Missing Values
    if (analysisResults.csv.missing_values) {
        csv += 'Missing Values\n';
        csv += 'Column,Count,Percentage\n';
        Object.entries(analysisResults.csv.missing_values.missing_counts).forEach(([col, count]) => {
            csv += `"${col}",${count},${analysisResults.csv.missing_values.missing_percentage[col]?.toFixed(1) ?? 0}%\n`;
        });
        csv += '\n';
    }

    // Sample Data
    if (analysisResults.csv.sample_rows?.length) {
        csv += 'Sample Data\n';
        const headers = Object.keys(analysisResults.csv.sample_rows[0]);
        csv += headers.join(',') + '\n';
        analysisResults.csv.sample_rows.forEach(row => {
            csv += headers.map(h => row[h] ?? '').join(',') + '\n';
        });
    }

    downloadFile(csv, `insightalysis-data-${Date.now()}.csv`, 'text/csv');
    showToast('CSV downloaded', 'success');
};

// ========================================
// Export: JSON
// ========================================
window.exportJSON = function() {
    if (!analysisResults) { showToast('No results to export', 'error'); return; }
    const json = JSON.stringify(analysisResults, null, 2);
    downloadFile(json, `insightalysis-results-${Date.now()}.json`, 'application/json');
    showToast('JSON downloaded', 'success');
};

// ========================================
// Export: Chart PNG
// ========================================
window.exportChartPNG = function() {
    const canvas = document.getElementById('chartCanvas');
    if (!canvas) { showToast('No chart to export', 'error'); return; }
    try {
        const link = document.createElement('a');
        link.download = `insightalysis-chart-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Chart image saved', 'success');
    } catch (e) {
        showToast('Chart export failed', 'error');
    }
};

// ========================================
// Export: Share Results (Self-Contained HTML)
// ========================================
window.shareResults = async function() {
    if (!analysisResults) { showToast('No results to share', 'error'); return; }

    try {
        showToast('Generating shareable file...', 'info', 2000);

        const shareData = {
            r: analysisResults,
            f: uploadedFiles.map(f => f.name),
            t: selectedAnalysisType,
            d: new Date().toISOString()
        };

        const html = generateSharedHTML(shareData);
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `insightalysis-shared-${timestamp}.html`;

        downloadFile(html, filename, 'text/html');
        showToast('Shared file downloaded! Send this file to anyone.', 'success', 5000);
    } catch (error) {
        showToast('Share failed: ' + error.message, 'error');
    }
};

function generateSharedHTML(shareData) {
    const dataJson = JSON.stringify(shareData);
    const files = shareData.f || [];
    const results = shareData.r || {};
    const date = shareData.d ? new Date(shareData.d).toLocaleDateString() : 'Unknown';

    const fileNames = files.join(', ') || 'Shared Analysis';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Insightalysis AI - Shared Analysis</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a0f;--bg2:#111118;--bg3:#1a1a24;--surface:#16161f;--border:#2a2a3a;--text:#e8e8ed;--text2:#9898a8;--text3:#6a6a7a;--accent:#818cf8;--accent-glow:rgba(129,140,248,0.15);--success:#34d399;--warning:#fbbf24;--danger:#f87171;--info:#22d3ee;--radius:10px;--shadow:0 4px 12px rgba(0,0,0,0.4)}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;min-height:100vh}
.header{background:var(--bg2);border-bottom:1px solid var(--border);padding:16px 24px;position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.header-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.header h1{font-size:18px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:8px}
.header h1 svg{width:22px;height:22px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:var(--accent-glow);color:var(--accent);border:1px solid rgba(129,140,248,0.3)}
.meta{font-size:12px;color:var(--text3)}
.container{max-width:900px;margin:0 auto;padding:24px}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;overflow:hidden}
.card-header{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;transition:background 0.2s}
.card-header:hover{background:var(--bg3)}
.card-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px}
.card-icon.summary{background:rgba(129,140,248,0.12);color:var(--accent)}
.card-icon.insights{background:rgba(251,191,36,0.12);color:var(--warning)}
.card-icon.data{background:rgba(34,211,238,0.12);color:var(--info)}
.card-icon.charts{background:rgba(52,211,153,0.12);color:var(--success)}
.card-icon.model{background:rgba(248,113,113,0.12);color:var(--danger)}
.card-icon.recs{background:rgba(129,140,248,0.12);color:var(--accent)}
.card-icon.questions{background:rgba(251,191,36,0.12);color:var(--warning)}
.card-icon.steps{background:rgba(52,211,153,0.12);color:var(--success)}
.card-title{font-size:14px;font-weight:600;flex:1}
.chevron{transition:transform 0.2s;color:var(--text3)}
.card.collapsed .card-body{display:none}
.card.collapsed .chevron{transform:rotate(-90deg)}
.card-body{padding:0 16px 16px}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:12px}
.stat-item{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px;text-align:center}
.stat-value{font-size:20px;font-weight:700;color:var(--accent);line-height:1.2}
.stat-label{font-size:11px;color:var(--text3);margin-top:2px;text-transform:uppercase;letter-spacing:0.5px}
.insight-list{list-style:none;display:flex;flex-direction:column;gap:6px}
.insight-item{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);font-size:13px;color:var(--text2)}
.insight-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:6px}
.insight-dot.success{background:var(--success)}
.insight-dot.warning{background:var(--warning)}
.insight-dot.danger{background:var(--danger)}
.data-block{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-top:12px}
.data-block-header{padding:8px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px}
.data-block pre{padding:12px;font-size:12px;font-family:'SF Mono','Consolas',monospace;color:var(--text2);overflow-x:auto;line-height:1.6}
.chart-wrapper{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-top:12px}
.chart-controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.chart-controls select,.chart-controls button{padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;font-family:inherit;cursor:pointer}
.chart-controls select:focus,.chart-controls button:hover{border-color:var(--accent);color:var(--accent)}
.chart-canvas{position:relative;height:300px}
.heatmap-table{width:100%;border-collapse:collapse;font-size:12px}
.heatmap-table th,.heatmap-table td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)}
.heatmap-table th{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px}
.heatmap-table td{color:var(--text2)}
.rec-list{display:flex;flex-direction:column;gap:10px}
.rec-item{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
.rec-type{font-size:12px;font-weight:600;color:var(--accent);margin-bottom:6px}
.rec-reason{font-size:13px;color:var(--text2);margin-bottom:8px}
.rec-algos{display:flex;flex-wrap:wrap;gap:6px}
.algo-tag{padding:3px 8px;background:var(--accent-glow);border:1px solid rgba(129,140,248,0.3);border-radius:4px;font-size:11px;color:var(--accent);font-weight:500}
.question-item{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:8px}
.question-text{font-size:13px;font-weight:500;color:var(--text);margin-bottom:10px}
.question-options{display:flex;flex-wrap:wrap;gap:6px}
.option-btn{padding:6px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;font-family:inherit;cursor:pointer;transition:all 0.2s}
.option-btn:hover{border-color:var(--accent);color:var(--accent)}
.option-btn.correct{background:rgba(52,211,153,0.1);border-color:var(--success);color:var(--success)}
.option-btn.wrong{background:rgba(248,113,113,0.1);border-color:var(--danger);color:var(--danger)}
.footer{text-align:center;padding:24px;color:var(--text3);font-size:12px;border-top:1px solid var(--border);margin-top:32px}
.footer a{color:var(--accent);text-decoration:none}
@media(max-width:640px){.container{padding:16px}.stat-grid{grid-template-columns:repeat(2,1fr)}.header-inner{flex-direction:column;align-items:flex-start}}
</style>
</head>
<body>
<div class="header">
<div class="header-inner">
<h1><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Insightalysis AI</h1>
<span class="badge">Shared View</span>
</div>
<div class="meta" style="max-width:900px;margin:8px auto 0">${fileNames} &middot; ${date}</div>
</div>
<div class="container" id="results"></div>
<div class="footer">Generated by <a href="#">Insightalysis AI</a> &middot; Read-only shared view</div>
<script>
const SHARE_DATA = ${dataJson};
const R = SHARE_DATA.r || {};
const resultsEl = document.getElementById('results');

function buildCard(title, iconClass, body) {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = '<div class="card-header" onclick="this.parentElement.classList.toggle(\\'collapsed\\')"><div class="card-icon ' + iconClass + '">' + iconClass.charAt(0).toUpperCase() + '</div><div class="card-title">' + title + '</div><svg class="chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></div><div class="card-body">' + body + '</div>';
    return d;
}

function renderSummary() {
    let h = '<p>Files: <strong>' + (SHARE_DATA.f || []).join(', ') + '</strong></p>';
    if (R.csv) h += '<p style="margin-top:6px">CSV analysis complete.</p>';
    if (R.pdf) h += '<p style="margin-top:6px">PDF analysis complete.</p>';
    if (R.model) h += '<p style="margin-top:6px">ML model evaluation complete.</p>';
    resultsEl.appendChild(buildCard('Summary', 'summary', h));
}

function renderInsights() {
    const ins = [];
    if (R.csv?.overview) {
        ins.push(R.csv.overview.rows + ' rows, ' + R.csv.overview.columns + ' columns');
        ins.push('Columns: ' + R.csv.overview.column_names.join(', '));
    }
    if (R.csv?.missing_values) {
        const cols = Object.entries(R.csv.missing_values.missing_counts || {}).filter(([,v]) => v > 0);
        if (cols.length) ins.push('Missing values in: ' + cols.map(([k]) => k).join(', '));
        else ins.push('No missing values detected');
    }
    if (R.pdf?.summary) ins.push('PDF: ' + R.pdf.summary.page_count + ' pages analyzed');
    if (R.model?.prediction_summary) ins.push('Model generated ' + R.model.prediction_summary.count + ' predictions');
    if (R.model?.schema_check) {
        var score = ((R.model.schema_check.compatibility_score || 0) * 100).toFixed(1);
        ins.push('Dataset-model compatibility: ' + score + '%');
    }
    if (!ins.length) ins.push('No insights available');
    var html = '<ul class="insight-list">' + ins.map(function(t) {
        return '<li class="insight-item"><span class="insight-dot"></span><span>' + t + '</span></li>';
    }).join('') + '</ul>';
    resultsEl.appendChild(buildCard('Key Insights', 'insights', html));
}

function renderData() {
    var h = '';
    if (R.csv?.overview) {
        h += '<div class="data-block"><div class="data-block-header">CSV Overview</div><pre>' + JSON.stringify(R.csv.overview, null, 2) + '</pre></div>';
    }
    if (R.model) {
        var m = R.model;
        var compat = ((m.schema_check?.compatibility_score || 0) * 100).toFixed(1);
        h += '<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;margin-bottom:8px">Model Analysis</div>';
        h += '<div class="stat-grid"><div class="stat-item"><div class="stat-value">' + compat + '%</div><div class="stat-label">Compatibility</div></div>';
        h += '<div class="stat-item"><div class="stat-value">' + (m.used_features || []).length + '</div><div class="stat-label">Features</div></div>';
        h += '<div class="stat-item"><div class="stat-value">' + (m.prediction_preview?.high_risk_count || 0) + '</div><div class="stat-label">High Risk</div></div></div>';
        if (m.evaluation && !m.evaluation.error) {
            var ev = m.evaluation;
            var isReg = ev.task_type === 'regression';
            h += '<div style="margin-top:12px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius)">';
            h += '<div style="font-size:12px;font-weight:600;margin-bottom:4px">Model Evaluation</div>';
            h += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Task: ' + (isReg ? 'Regression' : 'Classification') + '</div>';
            h += '<div class="stat-grid">';
            if (isReg) {
                h += '<div class="stat-item"><div class="stat-value">' + (ev.mae?.toFixed(3) || 'N/A') + '</div><div class="stat-label">MAE</div></div>';
                h += '<div class="stat-item"><div class="stat-value">' + (ev.rmse?.toFixed(3) || 'N/A') + '</div><div class="stat-label">RMSE</div></div>';
                h += '<div class="stat-item"><div class="stat-value">' + (ev.r2?.toFixed(3) || 'N/A') + '</div><div class="stat-label">R\u00B2</div></div>';
            } else {
                h += '<div class="stat-item"><div class="stat-value">' + ((ev.accuracy*100)?.toFixed(1) || 'N/A') + '%</div><div class="stat-label">Accuracy</div></div>';
                h += '<div class="stat-item"><div class="stat-value">' + ((ev.precision_weighted*100)?.toFixed(1) || 'N/A') + '%</div><div class="stat-label">Precision</div></div>';
                h += '<div class="stat-item"><div class="stat-value">' + ((ev.recall_weighted*100)?.toFixed(1) || 'N/A') + '%</div><div class="stat-label">Recall</div></div>';
                h += '<div class="stat-item"><div class="stat-value">' + ((ev.f1_weighted*100)?.toFixed(1) || 'N/A') + '%</div><div class="stat-label">F1 Score</div></div>';
            }
            h += '</div></div>';
        }
        h += '</div>';
    }
    if (R.pdf) {
        var pdf = R.pdf;
        var concepts = Array.isArray(pdf.key_concepts) ? pdf.key_concepts : pdf.key_concepts?.key_concepts || pdf.key_concepts?.keywords || [];
        h += '<div style="margin-top:12px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius)">';
        h += '<div style="font-size:12px;font-weight:600;margin-bottom:6px">PDF Summary</div>';
        h += '<p style="margin:0;color:var(--text2)">' + (pdf.summary?.summary || 'No summary') + '</p>';
        h += '<p style="margin:8px 0 0;font-size:11px;color:var(--text3)">Pages: ' + (pdf.summary?.page_count || 'N/A') + '</p></div>';
        if (concepts.length) h += '<div style="margin-top:8px;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius)"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">KEY CONCEPTS</div><p style="margin:0;font-size:12px;color:var(--text2)">' + concepts.join(', ') + '</p></div>';
    }
    if (!h) h = '<p style="color:var(--text3)">No data available.</p>';
    resultsEl.appendChild(buildCard('Data & Analysis', 'data', h));
}

function renderCharts() {
    if (!R.csv) return;
    var h = '<div class="chart-wrapper"><div class="chart-controls" id="chartControls"></div><div class="chart-canvas"><canvas id="chartCanvas"></canvas></div></div>';
    var card = buildCard('Visualizations', 'charts', h);
    resultsEl.appendChild(card);
    setTimeout(function() { setupCharts(); }, 200);
}

function setupCharts() {
    var ctrl = document.getElementById('chartControls');
    var canvas = document.getElementById('chartCanvas');
    if (!ctrl || !canvas) return;
    var numericCols = [];
    if (R.csv?.overview?.column_names && R.csv?.overview?.data_types) {
        R.csv.overview.column_names.forEach(function(c) {
            var dt = R.csv.overview.data_types[c] || '';
            if (dt.includes('int') || dt.includes('float')) numericCols.push(c);
        });
    }
    if (R.csv?.visualization_data) {
        Object.keys(R.csv.visualization_data).forEach(function(c) {
            if (numericCols.indexOf(c) === -1) numericCols.push(c);
        });
    }
    if (!numericCols.length) { ctrl.innerHTML = '<p style="color:var(--text-muted);font-size:12px">No numeric columns for charts</p>'; return; }
    var chartTypes = ['histogram', 'scatter', 'pie', 'box'];
    var html = '<select id="chartCol">';
    numericCols.forEach(function(c) { html += '<option value="' + c + '">' + c + '</option>'; });
    html += '</select><select id="chartType">';
    chartTypes.forEach(function(t) { html += '<option value="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'; });
    html += '</select>';
    ctrl.innerHTML = html;
    var colSel = document.getElementById('chartCol');
    var typeSel = document.getElementById('chartType');
    colSel.onchange = function() { drawChart(); };
    typeSel.onchange = function() { drawChart(); };
    drawChart();
}

var currentChart = null;

function isLightTheme() { return document.body.classList.contains('light'); }
function chartTickColor() { return isLightTheme() ? '#6a6a82' : '#6a6a7a'; }
function chartGridColor() { return isLightTheme() ? '#d4d7e0' : '#2a2a3a'; }
function chartLegendColor() { return isLightTheme() ? '#4a4a62' : '#9898a8'; }
function drawChart() {
    var colSel = document.getElementById('chartCol');
    var typeSel = document.getElementById('chartType');
    var canvas = document.getElementById('chartCanvas');
    if (!colSel || !typeSel || !canvas) return;
    var col = colSel.value;
    var type = typeSel.value;
    if (currentChart) { currentChart.destroy(); currentChart = null; }
    var ctx = canvas.getContext('2d');
    if (type === 'histogram' && R.csv?.visualization_data?.[col]) {
        var viz = R.csv.visualization_data[col];
        var edges = viz.bins || [];
        var counts = viz.counts || [];
        var labels = edges.slice(0, -1).map(function(e, i) { return e.toFixed(1) + '-' + edges[i+1].toFixed(1); });
        currentChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: col, data: counts, backgroundColor: 'rgba(129,140,248,0.6)', borderColor: '#818cf8', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: chartTickColor() }, grid: { color: chartGridColor() } }, x: { ticks: { color: chartTickColor(), maxRotation: 45 }, grid: { display: false } } } } });
    } else if (type === 'scatter' && R.csv?.visualization_data?.[col]) {
        var viz2 = R.csv.visualization_data[col];
        var allVals = [];
        if (R.csv.sample_rows) {
            R.csv.sample_rows.forEach(function(r, i) { var v = parseFloat(r[col]); if (!isNaN(v)) allVals.push({x: i+1, y: v}); });
        }
        currentChart = new Chart(ctx, { type: 'scatter', data: { datasets: [{ label: col, data: allVals, backgroundColor: 'rgba(129,140,248,0.6)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: chartTickColor() }, grid: { color: chartGridColor() } }, x: { ticks: { color: chartTickColor() }, grid: { color: chartGridColor() } } } } });
    } else if (type === 'pie' && R.csv?.descriptive_stats?.[col]) {
        var ds = R.csv.descriptive_stats[col];
        var pieLabels = ['Min', 'Q1', 'Median', 'Q3', 'Max'];
        var pieValues = [ds.min||0, ds.q1||(ds.min+ds.std_dev)||1, ds.median||ds.mean||2, ds.q3||(ds.mean+ds.std_dev)||3, ds.max||4];
        var colors = ['#818cf8','#34d399','#fbbf24','#f87171','#22d3ee'];
        currentChart = new Chart(ctx, { type: 'pie', data: { labels: pieLabels, datasets: [{ data: pieValues, backgroundColor: colors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: chartLegendColor(), font: { size: 11 } } } } } });
    } else if (type === 'box' && R.csv?.descriptive_stats?.[col]) {
        var stats = R.csv.descriptive_stats[col];
        var min = stats.min || 0, max = stats.max || 0, med = stats.median || stats.mean || 0;
        var q1 = (min + med) / 2, q3 = (med + max) / 2;
        currentChart = new Chart(ctx, { type: 'bar', data: { labels: [col], datasets: [{ label: 'Min', data: [min], backgroundColor: 'rgba(129,140,248,0.3)' }, { label: 'Q1', data: [q1 - min], backgroundColor: 'rgba(129,140,248,0.5)' }, { label: 'Median', data: [med - q1], backgroundColor: 'rgba(52,211,153,0.6)' }, { label: 'Q3', data: [q3 - med], backgroundColor: 'rgba(129,140,248,0.5)' }, { label: 'Max', data: [max - q3], backgroundColor: 'rgba(129,140,248,0.3)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: chartLegendColor() } } }, scales: { x: { stacked: true, ticks: { color: chartTickColor() }, grid: { display: false } }, y: { stacked: true, ticks: { color: chartTickColor() }, grid: { color: chartGridColor() } } } } });
    } else {
        currentChart = new Chart(ctx, { type: 'bar', data: { labels: ['No Data'], datasets: [{ label: 'N/A', data: [0], backgroundColor: 'rgba(129,140,248,0.3)' }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
}

function renderModel() {
    if (!R.model) return;
    var m = R.model;
    var h = '';
    if (m.prediction_preview?.rows?.length) {
        h += '<div style="overflow-x:auto"><table class="heatmap-table"><thead><tr><th>Row</th><th>Actual</th><th>Predicted</th><th>Error</th><th>Risk</th></tr></thead><tbody>';
        m.prediction_preview.rows.slice(0, 8).forEach(function(row) {
            var rc = row.risk === 'high' ? 'danger' : 'success';
            h += '<tr><td>' + row.row_index + '</td><td>' + (row.actual ?? '-') + '</td><td>' + row.predicted + '</td><td>' + (row.abs_error ?? '-') + '</td><td style="color:var(--' + rc + ');font-weight:600">' + (row.risk === 'high' ? 'High' : 'Normal') + '</td></tr>';
        });
        h += '</tbody></table></div>';
    }
    if (m.risk_alerts?.length) {
        h += '<ul class="insight-list" style="margin-top:12px">';
        m.risk_alerts.forEach(function(a) { h += '<li class="insight-item"><span class="insight-dot danger"></span><span>' + a + '</span></li>'; });
        h += '</ul>';
    }
    if (m.feature_importance?.length) {
        h += '<div style="margin-top:10px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">TOP FEATURES</div><ul class="insight-list">';
        m.feature_importance.slice(0, 5).forEach(function(f) { h += '<li class="insight-item"><span class="insight-dot"></span><span>' + f.feature + ': ' + Number(f.abs_importance).toFixed(4) + '</span></li>'; });
        h += '</ul></div>';
    }
    if (!h) return;
    resultsEl.appendChild(buildCard('ML Predictions', 'model', h));
}

function renderRecs() {
    var recs = R.csv?.followup_ideas?.recommendations;
    if (!recs?.length) return;
    var h = '<div class="rec-list">';
    recs.forEach(function(r) {
        h += '<div class="rec-item"><div class="rec-type">' + r.type + '</div><p class="rec-reason">' + r.reason + '</p><div class="rec-algos">' + r.algorithms.map(function(a) { return '<span class="algo-tag">' + a + '</span>'; }).join('') + '</div></div>';
    });
    h += '</div>';
    resultsEl.appendChild(buildCard('Recommended Techniques', 'recs', h));
}

function renderQuestions() {
    var qs = [];
    if (R.csv?.questions?.length) {
        R.csv.questions.forEach(function(q, i) { qs.push({ id: 'csv_' + i, q: q.question, opts: q.options, ci: q.correctIndex }); });
    }
    if (R.pdf?.questions?.questions?.length) {
        R.pdf.questions.questions.forEach(function(q, i) {
            if (typeof q === 'string') qs.push({ id: 'pdf_' + i, q: q, opts: ['True', 'False'], ci: 0 });
            else qs.push({ id: 'pdf_' + i, q: q.question || q, opts: q.options || ['True', 'False'], ci: q.correctIndex || 0 });
        });
    }
    if (!qs.length) return;
    var h = '';
    qs.forEach(function(q) {
        h += '<div class="question-item"><div class="question-text">' + q.q + '</div><div class="question-options">';
        q.opts.forEach(function(opt, i) {
            h += '<button class="option-btn" onclick="checkQ(this,' + q.ci + ')">' + opt + '</button>';
        });
        h += '<div class="question-feedback"></div></div></div>';
    });
    resultsEl.appendChild(buildCard('Practice Questions', 'questions', h));
}

window.checkQ = function(btn, correctIdx) {
    var btns = btn.parentElement.querySelectorAll('.option-btn');
    var fb = btn.parentElement.querySelector('.question-feedback');
    btns.forEach(function(b, i) {
        b.disabled = true;
        if (i === correctIdx) b.classList.add('correct');
        else if (b === btn && i !== correctIdx) b.classList.add('wrong');
    });
    if (btns.length > 0 && btns[correctIdx] === btn) fb.textContent = 'Correct!';
    else fb.textContent = 'Wrong. Correct answer: ' + btns[correctIdx].textContent;
    fb.style.color = btns[correctIdx] === btn ? '#34d399' : '#f87171';
};

function renderSteps() {
    var steps = [];
    if (R.csv?.followup_ideas?.ideas) steps.push(...R.csv.followup_ideas.ideas);
    if (R.pdf?.recommendations?.next_steps) steps.push(...R.pdf.recommendations.next_steps);
    if (!steps.length) { steps.push('Validate findings with domain knowledge'); steps.push('Try different model algorithms'); }
    var h = '<ul class="insight-list">' + steps.map(function(s) { return '<li class="insight-item"><span class="insight-dot success"></span><span>' + s + '</span></li>'; }).join('') + '</ul>';
    resultsEl.appendChild(buildCard('Next Steps', 'steps', h));
}

renderSummary();
renderInsights();
renderData();
renderCharts();
renderModel();
renderRecs();
renderQuestions();
renderSteps();
</script>
</body>
</html>`;
}

// ========================================
// Helper: Download File
// ========================================
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ========================================
// Load Shared Results on Page Load
// ========================================
function loadSharedResults() {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    const resultId = params.get('result');

    if (!dataParam && !resultId) return;

    document.body.classList.add('shared-view');

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.hidden = true;

    const topbarActions = document.getElementById('topbarActions');
    if (topbarActions) topbarActions.hidden = true;

    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.hidden = true;

    showToast('Loading shared analysis...', 'info');

    if (dataParam) {
        try {
            const jsonStr = decodeURIComponent(escape(atob(dataParam)));
            const shareData = JSON.parse(jsonStr);

            analysisResults = shareData.r;
            uploadedFiles = (shareData.f || []).map(name => ({ name, size: 0 }));
            selectedAnalysisType = shareData.t || 'auto';

            showSharedView(shareData.f);
        } catch (error) {
            console.error('Failed to decode shared data:', error);
            showToast('Invalid share link', 'error');
        }
    } else if (resultId) {
        loadSharedFromBackend(resultId);
    }
}

async function loadSharedFromBackend(resultId) {
    try {
        const response = await fetch(`${API_URL}/results/${resultId}`);
        if (!response.ok) throw new Error('Shared results not found');

        const result = await response.json();
        if (result.status === 'success' && result.data) {
            analysisResults = result.data.results;
            uploadedFiles = (result.data.files || []).map(name => ({ name, size: 0 }));
            selectedAnalysisType = result.data.type || 'auto';

            showSharedView(result.data.files);
        }
    } catch (error) {
        console.error('Failed to load shared results:', error);
        showToast('Failed to load: ' + error.message, 'error');
    }
}

function showSharedView(fileNames) {
    emptyState.hidden = true;
    loadingState.hidden = true;
    resultsContainer.hidden = false;

    const names = fileNames?.join(', ') || 'Shared analysis';
    document.getElementById('topbarMode').innerHTML = `
        <span>${names.length > 40 ? names.substring(0, 40) + '...' : names}</span>
        <span class="shared-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Shared View
        </span>
    `;

    renderSharedResults();
    showToast('Shared results loaded', 'success');
}

function renderSharedResults() {
    resultsContainer.innerHTML = '';

    if (analysisResults?.csv || analysisResults?.pdf) resultsContainer.appendChild(buildSummaryCard());

    const insights = collectInsights();
    if (insights.length > 0) resultsContainer.appendChild(buildInsightsCard(insights));

    resultsContainer.appendChild(buildDataCard());

    if (analysisResults?.csv) {
        resultsContainer.appendChild(buildChartCard());
    }

    if (analysisResults?.model) resultsContainer.appendChild(buildModelCard());
    if (analysisResults?.csv?.followup_ideas?.recommendations) resultsContainer.appendChild(buildRecommendationsCard());
    resultsContainer.appendChild(buildQuestionsCard());
    resultsContainer.appendChild(buildNextStepsCard());

    if (displayResultsTimer) { clearTimeout(displayResultsTimer); displayResultsTimer = null; }
    displayResultsTimer = setTimeout(() => {
        if (analysisResults?.csv) { try { setupChartControls(); drawChart(); } catch (e) { console.error('Chart render failed:', e); } }
    }, 200);
}

window.resetTool = function () {
    uploadedFiles = [];
    uploadedModel = null;
    selectedAnalysisType = 'auto';
    analysisResults = null;
    insightPopupShown = false;
    chartSelection = { feature: null, chartType: 'histogram', scatterY: null };
    isAnalyzing = false;

    if (currentChart) { currentChart.destroy(); currentChart = null; }
    if (displayResultsTimer) { clearTimeout(displayResultsTimer); displayResultsTimer = null; }

    if (fileList) fileList.innerHTML = '';
    if (modelList) modelList.innerHTML = '';
    if (modelStatus) { modelStatus.hidden = true; modelStatus.textContent = ''; }
    if (targetColumnInput) targetColumnInput.value = '';
    if (fileInput) fileInput.value = '';
    if (modelInput) modelInput.value = '';

    emptyState.hidden = false;
    loadingState.hidden = true;
    resultsContainer.hidden = true;
    resultsContainer.innerHTML = '';

    const topbarActions = document.getElementById('topbarActions');
    if (topbarActions) topbarActions.hidden = true;
    updateTopbar();

    $$('.mode-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.type === 'auto');
    });

    const heatmapContainer = document.getElementById('heatmapContainer');
    if (heatmapContainer) { heatmapContainer.innerHTML = ''; heatmapContainer.style.display = 'none'; }
    const chartCanvas = document.getElementById('chartCanvas');
    if (chartCanvas) chartCanvas.style.display = '';

    showToast('Tool refreshed! Ready for new analysis.', 'success');
};

// Run on page load
loadSharedResults();

// Splash screen
(function() {
    var splash = document.getElementById('splashScreen');
    if (splash) {
        setTimeout(function() { splash.classList.add('hide'); }, 3200);
        setTimeout(function() { splash.remove(); }, 3900);
    }
})();

console.log('Insightalysis AI loaded');
