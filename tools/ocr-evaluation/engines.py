"""Lokāli OCR dzinēji; dokumentu saturs netiek nosūtīts tīklā."""
from __future__ import annotations

import csv
import io
import os
from pathlib import Path
import re
import subprocess

from analysis import AnalysisError


class TesseractEngine:
    name = 'tesseract'

    def __init__(self, executable='tesseract', languages='lav+eng+rus', timeout=60):
        if Path(executable).is_file():
            executable = str(Path(executable).resolve())
        self.executable, self.languages, self.timeout = executable, languages, timeout
        self.version = self.run(['--version']).splitlines()[0]
        available = self.run(['--list-langs']).splitlines()[1:]
        missing = set(languages.split('+')) - {v.strip() for v in available}
        if missing:
            raise AnalysisError('missing_languages', 'Trūkst Tesseract valodu: ' + ', '.join(sorted(missing)))

    def run(self, args):
        try:
            result = subprocess.run([self.executable, *args], capture_output=True, timeout=self.timeout, check=False)
        except FileNotFoundError as exc:
            raise AnalysisError('engine_not_installed', 'Tesseract nav atrasts; norādiet --tesseract vai PATH.') from exc
        except subprocess.TimeoutExpired as exc:
            raise AnalysisError('ocr_timeout', 'Pārsniegts OCR procesa laiks.') from exc
        if result.returncode:
            # stderr var saturēt privātus failu ceļus; publiskajā kļūdā to neiekļauj.
            raise AnalysisError('ocr_process_failed', 'Tesseract process beidzās ar kļūdu; pārbaudiet instalāciju un ievadi.')
        return result.stdout.decode('utf-8', errors='replace')

    def recognize(self, image, directory: Path, auto_orient=False):
        path = directory / 'page.png'
        image.save(path)
        warnings = []
        rotation = 0
        if auto_orient:
            try:
                osd = self.run([str(path), 'stdout', '--psm', '0'])
                rotate = re.search(r'Rotate:\s*(\d+)', osd)
                confidence = re.search(r'Orientation confidence:\s*([\d.]+)', osd)
                if rotate and confidence and float(confidence.group(1)) >= 15:
                    rotation = int(rotate.group(1))
                    image = image.rotate(-rotation, expand=True, fillcolor='white')
                    image.save(path)
                else:
                    warnings.append('orientation_uncertain')
            except AnalysisError as exc:
                if exc.code == 'ocr_timeout':
                    raise
                warnings.append('orientation_unavailable')
        tsv = self.run([str(path), 'stdout', '-l', self.languages, '--psm', '3', '-c', 'tessedit_create_tsv=1'])
        if not tsv.startswith('level\tpage_num\t'):
            raise AnalysisError('invalid_ocr_output', 'OCR neatgrieza TSV struktūru; pārbaudiet dzinēja konfigurāciju.')
        grouped = {}
        for row in csv.DictReader(io.StringIO(tsv), delimiter='\t', quoting=csv.QUOTE_NONE):
            if row.get('level') != '5' or not row.get('text', '').strip():
                continue
            key = (row['block_num'], row['par_num'], row['line_num'])
            left, top, width, height = (int(row[k]) for k in ('left', 'top', 'width', 'height'))
            conf = float(row['conf'])
            grouped.setdefault(key, []).append({
                'text': row['text'].strip(), 'bbox': [left, top, left + width, top + height],
                'confidence': max(0, min(1, conf / 100)) if conf >= 0 else None,
            })
        lines = []
        for words in grouped.values():
            bbox = [min(w['bbox'][0] for w in words), min(w['bbox'][1] for w in words),
                    max(w['bbox'][2] for w in words), max(w['bbox'][3] for w in words)]
            lines.append({'text': ' '.join(w['text'] for w in words), 'bbox': bbox, 'words': words})
        return lines, image.size, rotation, warnings


class PaddleEngine:
    """Eksperimentāls PaddleOCR 3.x adapteris. Tikai jau lejupielādēti modeļi."""
    name = 'paddle'

    def __init__(self, detection_dir, recognition_dir, recognition_name='latin_PP-OCRv5_mobile_rec'):
        if not detection_dir or not recognition_dir:
            raise AnalysisError('missing_models', 'Paddle prasa --paddle-det un --paddle-rec lokālas modeļu mapes.')
        for directory in (detection_dir, recognition_dir):
            if not Path(directory).is_dir():
                raise AnalysisError('missing_models', 'Nav atrasta lokāla Paddle modeļa mape.')
        # Nepārbauda modeļu lejupielādes serverus. Nav automātisku lejupielāžu.
        os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'
        try:
            import paddleocr
            from paddleocr import PaddleOCR
            self.version = paddleocr.__version__
            self.model = PaddleOCR(
                device='cpu', text_detection_model_name='PP-OCRv5_mobile_det',
                text_recognition_model_name=recognition_name,
                text_detection_model_dir=str(Path(detection_dir).resolve()),
                text_recognition_model_dir=str(Path(recognition_dir).resolve()),
                use_doc_orientation_classify=False, use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        except ImportError as exc:
            raise AnalysisError('engine_not_installed', 'PaddleOCR/PaddlePaddle nav instalēts šajā Python vidē.') from exc

    def recognize(self, image, directory: Path, auto_orient=False):
        import numpy as np
        lines = []
        # Paddle pieņem BGR attēlu, nevis Pillow RGB.
        for result in self.model.predict(np.asarray(image)[:, :, ::-1].copy()):
            for text, score, polygon in zip(result['rec_texts'], result['rec_scores'], result['rec_polys']):
                if not text.strip():
                    continue
                xs, ys = zip(*polygon)
                box = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
                word = {'text': text, 'confidence': float(score), 'bbox': box}
                lines.append({'text': text, 'bbox': box, 'words': [word]})
        return lines, image.size, 0, ['paddle_adapter_unvalidated'] + (['orientation_unavailable'] if auto_orient else [])
