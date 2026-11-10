"""CER/WER tikai pret zināmu transkripciju; nav atribūtu precizitātes mērījums."""
import argparse
import json
from pathlib import Path
import unicodedata


def distance(left, right):
    previous = list(range(len(right) + 1))
    for i, a in enumerate(left, 1):
        current = [i]
        for j, b in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j-1] + (a != b)))
        previous = current
    return previous[-1]


def normalize(text):
    return ' '.join(unicodedata.normalize('NFC', text).split())


def main():
    parser = argparse.ArgumentParser(description='Aprēķina CER/WER pret pārbaudītu teksta etalonu.')
    parser.add_argument('reference', type=Path)
    parser.add_argument('result', type=Path)
    args = parser.parse_args()
    expected = normalize(args.reference.read_text(encoding='utf-8'))
    result = json.loads(args.result.read_text(encoding='utf-8'))
    actual = normalize('\n'.join(page['text'] for page in result['pages']))
    if not expected:
        parser.error('Etalona teksts nedrīkst būt tukšs.')
    print(json.dumps({'cer': distance(expected, actual) / len(expected),
                      'wer': distance(expected.split(), actual.split()) / len(expected.split()),
                      'reference_characters': len(expected), 'normalization': 'NFC_whitespace_only'}))


if __name__ == '__main__':
    main()
