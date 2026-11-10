"""Neatkarīgs lokāls OCR CLI attēliem un rastrētiem PDF."""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
import warnings

from analysis import AnalysisError, CorporateAiProvider, LocalOcrProvider

MAX_BYTES = 25 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_PAGES = 20


def input_pages(path: Path, dpi: int):
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    if not path.is_file():
        raise AnalysisError('file_not_found', 'Nav atrasts lokāls ievades fails.')
    if not 0 < path.stat().st_size <= MAX_BYTES:
        raise AnalysisError('file_size_limit', 'Fails ir tukšs vai pārsniedz 25 MiB.')
    with path.open('rb') as source:
        header = source.read(5)
    if header == b'%PDF-':
        import pypdfium2 as pdfium
        with pdfium.PdfDocument(path) as document:
            if not 0 < len(document) <= MAX_PAGES:
                raise AnalysisError('page_limit', 'PDF jābūt 1–20 lapām.')
            for index in range(len(document)):
                page = document[index]
                try:
                    width, height = page.get_size()
                    if not all(math.isfinite(v) and v > 0 for v in (width, height)):
                        raise AnalysisError('invalid_dimensions', 'Nederīgi PDF lapas izmēri.')
                    if math.ceil(width * dpi / 72) * math.ceil(height * dpi / 72) > MAX_PIXELS:
                        raise AnalysisError('pixel_limit', 'PDF lapa pārsniedz 40 megapikseļus; samaziniet --dpi.')
                    bitmap = page.render(scale=dpi / 72)
                    try:
                        image = bitmap.to_pil().convert('RGB')
                    finally:
                        bitmap.close()
                    yield index + 1, image
                finally:
                    page.close()
    else:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(path) as source:
                if source.format not in {'JPEG', 'PNG', 'TIFF', 'WEBP'}:
                    raise AnalysisError('unsupported_format', 'Atbalstīti JPEG, PNG, TIFF, WEBP un PDF.')
                if getattr(source, 'n_frames', 1) != 1:
                    raise AnalysisError('multiframe_image', 'Daudzkadru attēlu vispirms sadaliet atsevišķās lapās.')
                if source.width * source.height > MAX_PIXELS:
                    raise AnalysisError('pixel_limit', 'Attēls pārsniedz 40 megapikseļus.')
                if min(source.size) < 100:
                    raise AnalysisError('image_too_small', 'Attēla malām jābūt vismaz 100 pikseļu garām.')
                image = ImageOps.exif_transpose(source).convert('RGBA')
                background = Image.new('RGB', image.size, 'white')
                background.paste(image, mask=image.getchannel('A'))
                yield 1, background


def process(path: Path, engine, dpi=300, auto_orient=False):
    start = time.perf_counter()
    pages, engine_warnings = [], []
    # Pagaidu rastri paliek vienīgi lokālajā privātajā mapē un tiek dzēsti.
    private = Path(__file__).resolve().parent / 'private'
    private.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='ocr-', dir=private) as temporary:
        for number, image in input_pages(path, dpi):
            try:
                tick = time.perf_counter()
                lines, size, rotation, notices = engine.recognize(image, Path(temporary), auto_orient)
                engine_warnings.extend(notices)
                pages.append({'number': number, 'width': size[0], 'height': size[1],
                              'rotation_clockwise': rotation, 'text': '\n'.join(line['text'] for line in lines),
                              'lines': lines, 'elapsed_seconds': round(time.perf_counter() - tick, 4)})
            finally:
                image.close()
    result = LocalOcrProvider().analyze(pages)
    result['ocr'] = {'engine': engine.name, 'version': engine.version,
                     'requested_languages': engine.languages if engine.name == 'tesseract' else None,
                     'elapsed_seconds': round(time.perf_counter() - start, 4),
                     'coordinate_space': 'processed_image_pixels_top_left_xyxy'}
    result['warnings'].extend(sorted(set(engine_warnings)))
    if not any(page['text'].strip() for page in pages):
        result['warnings'].append('no_text_detected')
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description='Lokāls OCR: attēls/PDF → JSON; visi rezultāti jāpārbauda.')
    parser.add_argument('input', type=Path)
    parser.add_argument('--engine', choices=['tesseract', 'paddle'], default='tesseract')
    parser.add_argument('--tesseract', default=os.environ.get('TESSERACT_CMD', 'tesseract'))
    parser.add_argument('--languages', default='lav+eng+rus')
    parser.add_argument('--timeout', type=int, default=60, help='Tesseract viena procesa limits sekundēs')
    parser.add_argument('--dpi', type=int, default=300)
    parser.add_argument('--auto-orient', action='store_true')
    parser.add_argument('--paddle-det')
    parser.add_argument('--paddle-rec')
    parser.add_argument('--paddle-rec-name', default='latin_PP-OCRv5_mobile_rec')
    parser.add_argument('--output', type=Path, help='Privāts JSON fails; bez šī parametra izmanto stdout')
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    try:
        if not 72 <= args.dpi <= 600 or not 1 <= args.timeout <= 600:
            raise AnalysisError('invalid_options', '--dpi jābūt 72–600, --timeout 1–600.')
        provider = os.environ.get('DOCUMENT_AI_PROVIDER', 'local')
        if provider == 'corporate_ai':
            CorporateAiProvider().analyze([])
        if provider != 'local':
            raise AnalysisError('invalid_provider', 'CLI atbalsta tikai local; mock izmantojams testos.')
        from engines import PaddleEngine, TesseractEngine
        engine = (TesseractEngine(args.tesseract, args.languages, args.timeout) if args.engine == 'tesseract'
                  else PaddleEngine(args.paddle_det, args.paddle_rec, args.paddle_rec_name))
        result = process(args.input, engine, args.dpi, args.auto_orient)
        payload = json.dumps(result, ensure_ascii=False, indent=2)
        if args.output:
            if args.output.resolve() == args.input.resolve():
                raise AnalysisError('output_conflict', 'Rezultāts nedrīkst pārrakstīt ievades failu.')
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(payload + '\n', encoding='utf-8')
        else:
            print(payload)
        return 0
    except Exception as exc:
        if isinstance(exc, AnalysisError):
            code, message = exc.code, str(exc)
        elif isinstance(exc, ImportError):
            code, message = 'missing_dependency', 'Trūkst Python atkarības; instalējiet requirements.txt.'
        else:
            code, message = 'processing_failed', 'Dokumentu neizdevās apstrādāt; pārbaudiet failu, piekļuvi un OCR instalāciju.'
        print(json.dumps({'error': {'code': code, 'message': message}, 'requires_review': True}, ensure_ascii=False))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
