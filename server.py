import os
import sys
import tempfile
import subprocess
from pathlib import Path
from flask import Flask, request, send_file, send_from_directory, jsonify

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/convert-pdf', methods=['POST'])
def convert_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    format_type = request.form.get('format', 'DCCB')
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400

    # Create a temporary directory to work in
    temp_dir = tempfile.mkdtemp()
    pdf_path = os.path.join(temp_dir, file.filename)
    excel_path = os.path.join(temp_dir, 'Extracted_Data.xlsx')
    
    file.save(pdf_path)
    
    # Choose script
    script = 'convert_dccb_cli.py' if format_type == 'DCCB' else 'run_scb_pacs.py'
    
    # Run conversion
    try:
        print(f"Running conversion: {script} on {pdf_path}")
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        result = subprocess.run(
            [sys.executable, script, temp_dir, excel_path],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=env,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        if result.returncode != 0:
            print("Conversion Error:", result.stderr)
            return jsonify({'error': f'Conversion failed: {result.stderr}'}), 500
            
        if not os.path.exists(excel_path):
            return jsonify({'error': 'Conversion completed but output Excel was not generated.'}), 500
            
        return send_file(
            excel_path,
            as_attachment=True,
            download_name=f"{format_type}_Extracted_{file.filename}.xlsx"
        )
        
    except Exception as e:
        print("Exception:", e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    print("=======================================================")
    print("Starting NAFSCOB Dashboard & Converter Server...")
    print(f"URL: http://0.0.0.0:{port}")
    print("Press Ctrl+C to stop")
    print("=======================================================")
    app.run(host='0.0.0.0', port=port, debug=debug)
