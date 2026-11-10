"""Read capture times from local photo metadata; never sends images to a server."""
import argparse
import csv
from collections import Counter
from datetime import datetime
from pathlib import Path
from PIL import Image, ExifTags

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

EXTENSIONS = {'.jpg', '.jpeg', '.heic', '.heif', '.tif', '.tiff', '.png', '.webp'}
EXIF_DATETIME_ORIGINAL = 36867
EXIF_DATETIME_DIGITIZED = 36868
EXIF_DATETIME = 306
EXIF_IFD_POINTER = 34665


def capture_time(path):
    with Image.open(path) as im:
        exif = im.getexif()
        exif_ifd = exif.get_ifd(EXIF_IFD_POINTER) if exif else {}
        candidates = [
            exif_ifd.get(EXIF_DATETIME_ORIGINAL),
            exif.get(EXIF_DATETIME_ORIGINAL),
            exif_ifd.get(EXIF_DATETIME_DIGITIZED),
            exif.get(EXIF_DATETIME_DIGITIZED),
            exif.get(EXIF_DATETIME),
            im.info.get('date:create'),
        ]
        for value in candidates:
            if isinstance(value, bytes):
                value = value.decode('utf-8', errors='ignore')
            if isinstance(value, str):
                try:
                    return datetime.strptime(value.strip()[:19], '%Y:%m:%d %H:%M:%S')
                except ValueError:
                    pass
    return None


def run(source, out):
    files = sorted(p for p in source.rglob('*') if p.is_file() and p.suffix.lower() in EXTENSIONS)
    rows, missing, errors = [], [], []
    for p in files:
        try:
            dt = capture_time(p)
            if not dt:
                missing.append(p.name)
                continue
            rows.append(dict(photo_id=f'P{len(rows)+1:06d}', year=dt.year, month=dt.month,
                             date=dt.strftime('%Y-%m-%d'), hour=dt.hour,
                             weekday=dt.strftime('%A'), timestamp=dt.strftime('%Y-%m-%d %H:%M:%S')))
        except Exception as exc:
            errors.append((p.name, str(exc)))
    out.mkdir(parents=True, exist_ok=True)
    with (out / 'photo_times_private.csv').open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['photo_id','year','month','date','hour','weekday','timestamp'])
        w.writeheader(); w.writerows(rows)
    groups = Counter((r['year'], r['month'], r['hour']) for r in rows)
    with (out / 'hourly_monthly_aggregate.csv').open('w', newline='') as f:
        w = csv.writer(f); w.writerow(['year','month','hour','photo_count'])
        for k,v in sorted(groups.items()): w.writerow([*k,v])
    with (out / 'import_report.txt').open('w') as f:
        f.write(f'Files scanned: {len(files)}\nPhotos with readable capture times: {len(rows)}\nMissing timestamps: {len(missing)}\nUnreadable files: {len(errors)}\n')
        f.write('\nMissing timestamp filenames (private):\n' + '\n'.join(missing))
        f.write('\n\nUnreadable files (private):\n' + '\n'.join(f'{n}: {e}' for n,e in errors))
    print(f'Analyzed {len(rows)}/{len(files)} photos. Results: {out}')
    if missing or errors: print(f'Skipped {len(missing)} missing timestamps, {len(errors)} errors. See import_report.txt')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('data/raw'))
    parser.add_argument('--out', type=Path, default=Path('data/outputs'))
    a = parser.parse_args(); run(a.source, a.out)
