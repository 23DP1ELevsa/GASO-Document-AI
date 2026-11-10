"""Atkārtojams lokāls mērījums; sākotnējie faili un OCR teksts paliek private/."""
import argparse
import json
from pathlib import Path

from engines import TesseractEngine
from ocr_demo import process


def main():
    parser = argparse.ArgumentParser(description='Lokāls Tesseract mērījums ar anonīmiem D01… identifikatoriem.')
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--tesseract', default='tesseract')
    parser.add_argument('--languages', default='lav+eng+rus')
    parser.add_argument('--dpi', type=int, default=300)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent / 'private' / 'benchmark'
    root.mkdir(parents=True, exist_ok=True)
    engine = TesseractEngine(args.tesseract, args.languages)
    rows, manifest = [], []
    for i, path in enumerate(sorted(args.files)):
        alias = f'D{i+1:02}'
        manifest.append({'id': alias, 'local_file': str(path.resolve())})
        try:
            result = process(path, engine, args.dpi)
            (root / f'{alias}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
            row = {'id': alias, 'pages': len(result['pages']), 'seconds': result['ocr']['elapsed_seconds'],
                   'characters': sum(len(p['text']) for p in result['pages']),
                   'type_candidate': result['document_type'],
                   'non_null_attributes': sum(v is not None for v in result['attributes'].values())}
        except Exception as exc:
            row = {'id': alias, 'error': getattr(exc, 'code', type(exc).__name__)}
        rows.append(row)
        print(json.dumps(row), flush=True)
    (root / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (root / 'summary.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
    return int(any('error' in row for row in rows))


if __name__ == '__main__':
    raise SystemExit(main())
