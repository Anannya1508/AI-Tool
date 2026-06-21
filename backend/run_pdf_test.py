from PyPDF2 import PdfWriter
from pathlib import Path
import requests

p = Path('backend/uploads/sample_paper.pdf')

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    temp = Path('backend/uploads/tmp_sample.pdf')
    c = canvas.Canvas(str(temp), pagesize=letter)
    c.drawString(100, 750, 'Sample PDF for Insightalysis AI Testing')
    c.drawString(100, 730, 'This is page one. Analyses should read this text.')
    c.showPage()
    c.drawString(100, 750, 'Page two text for summary verification.')
    c.save()
    temp.rename(p)
    print('Sample PDF created via reportlab', p)
except Exception as e:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    with open(p, 'wb') as f:
        writer.write(f)
    print('Sample PDF created blank', p, 'error', e)

url = 'http://127.0.0.1:5000/analyze-pdf'
with open(p,'rb') as f:
    r = requests.post(url, files={'file': f})
print('status', r.status_code)
print(r.text)
