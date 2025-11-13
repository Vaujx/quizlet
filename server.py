from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import base64
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = Flask(__name__, static_folder='public', template_folder='public')
CORS(app)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set")

genai.configure(api_key=GEMINI_API_KEY)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('public', filename)

@app.route('/api/extract-pdf', methods=['POST'])
def extract_pdf():
    try:
        data = request.json
        file_base64 = data.get('file')
        
        if not file_base64:
            return jsonify({'error': 'No file data provided'}), 400
        
        # Decode base64 to bytes
        try:
            file_bytes = base64.b64decode(file_base64)
        except Exception as e:
            print(f"[v0] Base64 decode error: {str(e)}")
            return jsonify({'error': f'Invalid base64 encoding: {str(e)}'}), 400
        
        print(f"[v0] PDF file size: {len(file_bytes)} bytes")
        
        # Use PyPDF2 to extract text
        import io
        from PyPDF2 import PdfReader
        
        try:
            pdf_reader = PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            
            if not text or len(text.strip()) == 0:
                print("[v0] Warning: PDF extracted but no text found")
                return jsonify({'error': 'Could not extract text from PDF. The PDF might be empty or contain only images.'}), 400
            
            print(f"[v0] Successfully extracted {len(text)} characters from PDF")
            return jsonify({'text': text})
        except Exception as e:
            print(f"[v0] PDF extraction error: {str(e)}")
            return jsonify({'error': f'Failed to parse PDF: {str(e)}'}), 400
            
    except Exception as e:
        print(f"[v0] Unexpected error in extract-pdf: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/extract-docx', methods=['POST'])
def extract_docx():
    try:
        data = request.json
        file_base64 = data.get('file')
        
        if not file_base64:
            return jsonify({'error': 'No file data provided'}), 400
        
        # Decode base64 to bytes
        try:
            file_bytes = base64.b64decode(file_base64)
        except Exception as e:
            print(f"[v0] Base64 decode error: {str(e)}")
            return jsonify({'error': f'Invalid base64 encoding: {str(e)}'}), 400
        
        print(f"[v0] DOCX file size: {len(file_bytes)} bytes")
        
        # Use python-docx to extract text
        import io
        from docx import Document
        
        try:
            doc = Document(io.BytesIO(file_bytes))
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            
            if not text or len(text.strip()) == 0:
                print("[v0] Warning: DOCX extracted but no text found")
                return jsonify({'error': 'Could not extract text from DOCX. The document might be empty.'}), 400
            
            print(f"[v0] Successfully extracted {len(text)} characters from DOCX")
            return jsonify({'text': text})
        except Exception as e:
            print(f"[v0] DOCX extraction error: {str(e)}")
            return jsonify({'error': f'Failed to parse DOCX: {str(e)}'}), 400
            
    except Exception as e:
        print(f"[v0] Unexpected error in extract-docx: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    try:
        data = request.json
        content = data.get('content', '')
        num_questions = data.get('numQuestions', 5)
        difficulty = data.get('difficulty', 'mixed')
        question_type = data.get('questionType', 'mixed')

        if len(content) < 100:
            return jsonify({'error': 'Content is too short'}), 400

        prompt = f"""Generate exactly {num_questions} quiz questions based on the following content.

Difficulty: {difficulty}
Question Type: {question_type}

Content:
{content[:3000]}

Please generate the questions in JSON format with this exact structure:
{{
    "questions": [
        {{
            "question": "Question text",
            "type": "multiple_choice" or "true_false",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "correctAnswer": 0,
            "explanation": "Why this answer is correct"
        }}
    ]
}}

Rules:
- For multiple choice: provide 4 options, correctAnswer is the index (0-3)
- For true/false: provide options as ["True", "False"], correctAnswer is 0 or 1
- Make sure questions are clear and testable
- Vary difficulty if set to 'mixed'
- If question_type is 'mixed', use both multiple_choice and true_false
- Always return valid JSON
- Do not include any text before or after the JSON"""

        model = genai.GenerativeModel('gemini-2.0-flash-lite')
        response = model.generate_content(prompt)
        
        # Parse response
        response_text = response.text
        
        # Find JSON in response
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}') + 1
        
        if start_idx == -1 or end_idx == 0:
            return jsonify({'error': 'Failed to parse AI response'}), 400
        
        json_str = response_text[start_idx:end_idx]
        quiz_data = json.loads(json_str)
        
        return jsonify(quiz_data)
    
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON response from AI'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
