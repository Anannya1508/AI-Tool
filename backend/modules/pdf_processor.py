import PyPDF2
from io import BytesIO
import re
import urllib.parse

class PDFProcessor:
    def __init__(self, pdf_data):
        """
        Initialize with PDF data (file path or bytes)
        """
        if isinstance(pdf_data, str):
            with open(pdf_data, 'rb') as f:
                self.pdf_reader = PyPDF2.PdfReader(f)
        elif isinstance(pdf_data, bytes):
            self.pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_data))
        else:
            self.pdf_reader = pdf_data
        
        self.text = self._extract_all_text()

    def _extract_all_text(self):
        """Extract all text from PDF"""
        text = ""
        for page in self.pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text

    def get_summary(self):
        """Generate extractive summary from PDF text"""
        lines = [line.strip() for line in self.text.split('\n') if line.strip() and len(line.strip()) > 20]

        scored = []
        for i, line in enumerate(lines):
            score = 0
            lower = line.lower()
            if any(w in lower for w in ['propose', 'present', 'introduce', 'novel', 'method', 'approach', 'result', 'conclusion', 'finding', 'demonstrate', 'show', 'significant']):
                score += 3
            if i < len(lines) * 0.2:
                score += 2
            if i > len(lines) * 0.7:
                score += 1
            if any(c.isdigit() for c in line):
                score += 1
            if 30 < len(line) < 200:
                score += 1
            scored.append((line, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        top_lines = [line for line, _ in scored[:8]]
        seen = set()
        ordered = []
        for line in lines:
            if line in top_lines and line not in seen:
                ordered.append(line)
                seen.add(line)

        summary = " ".join(ordered) if ordered else " ".join(lines[:5])

        return {
            "page_count": len(self.pdf_reader.pages),
            "summary": summary[:800] if summary else "Unable to extract summary",
            "total_paragraphs": len([p for p in self.text.split('\n\n') if p.strip()])
        }

    def get_key_concepts(self):
        """Extract key concepts and keywords"""
        # Simple keyword extraction
        words = re.findall(r'\b[A-Za-z]{5,}\b', self.text)
        from collections import Counter
        
        word_freq = Counter(words)
        # Filter common words
        common_words = {'that', 'this', 'with', 'from', 'have', 'been', 'were', 'their', 'would', 'about', 'which', 'study', 'data', 'research'}
        keywords = [word for word, count in word_freq.most_common(10) if word.lower() not in common_words]
        
        return {
            "keywords": keywords[:10],
            "key_concepts": keywords[:5]
        }

    def get_text_sections(self):
        """Extract main text sections"""
        sections = self.text.split('\n\n')
        filtered_sections = [s.strip() for s in sections if len(s.strip()) > 50]
        
        return {
            "total_sections": len(filtered_sections),
            "main_content": " ".join(filtered_sections[:3])[:500],
            "section_count": len(filtered_sections)
        }

    def get_headings(self):
        """Extract probable headings from PDF text"""
        lines = [l.strip() for l in self.text.split('\n') if l.strip()]
        headings = []
        for line in lines:
            if len(line) > 5 and len(line) < 90 and (line.isupper() or line[0].isupper() and not line.endswith('.')):
                headings.append(line)
        return {
            "heading_count": len(headings),
            "headings": headings[:10]
        }

    def get_table_figures(self):
        """Attempt to detect tables/figures by keyword usage"""
        found = {
            "tables": [],
            "figures": []
        }

        for idx, line in enumerate(self.text.split('\n')):
            trimmed = line.strip().lower()
            if trimmed.startswith('table') and len(trimmed) < 70:
                found['tables'].append(trimmed)
            if trimmed.startswith('figure') and len(trimmed) < 70:
                found['figures'].append(trimmed)

        return {
            "table_count": len(found['tables']),
            "figure_count": len(found['figures']),
            "tables": found['tables'][:5],
            "figures": found['figures'][:5]
        }

    def generate_questions(self):
        """Generate student-friendly questions from PDF"""
        summary_text = self.get_summary().get('summary', '')
        key_concepts = self.get_key_concepts().get('key_concepts', [])

        questions = [
            f"What is the core idea behind {key_concepts[0]}?" if key_concepts else "What is the main topic discussed in this paper?",
            "What are the key findings presented?",
            "What methodology was used in the research?",
            "What are the limitations of this study?",
            "How can these findings be applied in practice?"
        ]

        if 'method' in summary_text.lower() or 'approach' in summary_text.lower():
            questions.insert(2, 'Describe the methodology in your own words.')

        return {"questions": questions}

    def get_reference_suggestions(self):
        """Suggest learning resources with topic-aware books and links"""
        key_concepts = self.get_key_concepts().get('key_concepts', [])
        keywords = self.get_key_concepts().get('keywords', [])

        # use strongest available concept or heavy keywords
        topic_terms = key_concepts if key_concepts else keywords
        if not topic_terms:
            topic_terms = ['research methods', 'data analysis', 'academic writing']

        # focus on up to 3 unique topics
        topics = []
        for t in topic_terms:
            normalized = t.lower().strip()
            if normalized and normalized not in topics:
                topics.append(normalized)
            if len(topics) >= 3:
                break

        book_suggestions = []
        for topic in topics:
            safe_topic = topic.replace('_', ' ').title()
            candidates = [
                f"{safe_topic} Fundamentals",
                f"Advanced {safe_topic}",
                f"Practical {safe_topic} Techniques"
            ]
            for candidate in candidates:
                query = urllib.parse.quote_plus(candidate)
                book_suggestions.append({
                    "title": candidate,
                    "link": f"https://www.google.com/search?q={query}"
                })

        # remove duplicates by title
        seen = set()
        book_suggestions = [b for b in book_suggestions if not (b['title'] in seen or seen.add(b['title']))]

        resource_suggestions = []
        for topic in topics:
            query = urllib.parse.quote_plus(topic)
            resource_suggestions.append({
                "name": f"Search {topic}",
                "link": f"https://scholar.google.com/scholar?q={query}"
            })

        resource_suggestions.extend([
            {"name": "ResearchGate", "link": "https://www.researchgate.net"},
            {"name": "ArXiv", "link": "https://arxiv.org"}
        ])

        return {
            "books": book_suggestions,
            "resources": resource_suggestions
        }

    def get_action_recommendations(self):
        """Next steps recommendations based on PDF content"""
        concept_list = self.get_key_concepts().get('key_concepts', [])
        headings = self.get_headings().get('headings', [])
        tbl_fig = self.get_table_figures()

        steps = []
        if concept_list:
            steps.append(f"Dig deeper into: {', '.join(concept_list[:3])}.")
            steps.append('Build a focused mind map around key concepts and research questions.')
        else:
            steps.append('Extract main themes manually and scope the domain for modeling.')

        if len(headings) > 5:
            steps.append('Use headings to outline a structured summary and identify key sections quickly.')

        if tbl_fig.get('table_count', 0) > 0:
            steps.append('Review table data for potential datasets and metrics to replicate in analysis.')

        if tbl_fig.get('figure_count', 0) > 0:
            steps.append('Capture insight from figures (trends, comparisons, distributions) and map to features.')

        steps.append('Use topic keywords to search for related datasets and scholarly articles.')

        return {
            "next_steps": steps,
            "risk_alerts": self.get_risk_alerts()
        }

    def get_risk_alerts(self):
        """Risk alerts derived from PDF analysis"""
        alerts = []

        key_concepts = self.get_key_concepts().get('key_concepts', [])
        if not key_concepts:
            alerts.append('Risk: No clear key concepts found; topic drift may reduce relevance of automated recommendations.')

        headings = self.get_headings().get('headings', [])
        if len(headings) < 3:
            alerts.append('Risk: Few headings detected; document structure may be weak, making extraction less reliable.')

        tbl_fig = self.get_table_figures()
        if tbl_fig.get('table_count', 0) == 0 and tbl_fig.get('figure_count', 0) == 0:
            alerts.append('Risk: No detected tables/figures; quality of quantitative extraction may be limited.')

        if not alerts:
            alerts.append('No major PDF extraction risks detected; analysis seems to have sufficient structure.')

        return alerts

    def get_full_analysis(self):
        """Get all PDF analysis in one call"""
        return {
            "summary": self.get_summary(),
            "key_concepts": self.get_key_concepts(),
            "text_sections": self.get_text_sections(),
            "headings": self.get_headings(),
            "table_figures": self.get_table_figures(),
            "questions": self.generate_questions(),
            "references": self.get_reference_suggestions(),
            "recommendations": self.get_action_recommendations()
        }
