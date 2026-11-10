"""Export hourly counts, weekday counts, and day coverage to the p5 sketch.

Run from `photo-time-p5/`: python private-tools/export_to_p5.py
"""
from collections import Counter
import csv
from datetime import date
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / 'private-data' / 'photo_times_private.csv'
SKETCH = ROOT / 'submission' / 'sketch.js'
START, END = '// DATA_START', '// DATA_END'

def main():
    if not INPUT.exists():
        raise SystemExit('Missing private-data/photo_times_private.csv. Run analyze.py or clean-metadata.py first.')
    tally = Counter()
    weekday_tally = Counter()
    dates = []
    with INPUT.open(newline='') as f:
        for r in csv.DictReader(f):
            year, hour = int(r['year']), int(r['hour'])
            if 2019 <= year <= 2026 and 0 <= hour <= 23:
                day = date.fromisoformat(r['date'])
                if day.year != year:
                    raise SystemExit('Capture date and year disagree in the private CSV.')
                tally[(year,hour)] += 1
                weekday_tally[(year, day.weekday())] += 1
                dates.append(day)
    if not tally: raise SystemExit('No timestamps from 2019–2026 found.')
    # Include zero-photo days between the first and last capture, including
    # whole empty years. Only day counts leave the private directory.
    first_day, last_day = min(dates), max(dates)
    days_by_year = {}
    for year in range(first_day.year, last_day.year + 1):
        start = max(first_day, date(year, 1, 1))
        end = min(last_day, date(year, 12, 31))
        days_by_year[year] = (end - start).days + 1
    years = []
    weekdays_by_year = {}
    for year, days in days_by_year.items():
        hours = [tally[(year, hour)] for hour in range(24)]
        weekdays = [weekday_tally[(year, weekday)] for weekday in range(7)]
        weekdays_by_year[year] = weekdays
        years.append(
            '  {\n'
            f'    year: {year},\n'
            f'    days: {days},\n'
            f'    hours: {json.dumps(hours)},\n'
            f'    weekdays: {json.dumps(weekdays)}\n'
            '  }'
        )
    snippet = 'let photoData = [\n' + ',\n'.join(years) + '\n];'
    content = SKETCH.read_text()
    if content.count(START) != 1 or content.count(END) != 1:
        raise SystemExit('Missing data markers in sketch.js')
    if 'const PHOTO_DATA =' in content:
        records = [dict(year=y, hour=h, count=n) for (y, h), n in sorted(tally.items())]
        snippet = 'const PHOTO_DATA = ' + json.dumps({
            'source': 'private-aggregate',
            'daysByYear': days_by_year,
            'weekdaysByYear': weekdays_by_year,
            'records': records,
        }, separators=(',', ':')) + ';'
    before, after_start = content.split(START,1)
    _, after = after_start.split(END,1)
    SKETCH.write_text(before + START + '\n' + snippet + '\n' + END + after)
    print(f'Embedded hourly and weekday counts from {sum(tally.values())} photos covering {sum(days_by_year.values())} calendar days. No images or exact dates were exported.')

if __name__=='__main__':main()
