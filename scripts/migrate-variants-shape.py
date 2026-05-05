#!/usr/bin/env python3
"""P6-127 / ADR-031 — Migrate axes.variants from string-array to object-array shape.

Before:
  axes:
    variants:
      - default
      - dot

After:
  axes:
    variants:
      - name: default
      - name: dot

Idempotent: a second run finds no `^    - bareName$` lines and reports 0 changes.
Operates on `^  variants:$` (axes-nested, 2-space indent) — never touches other
list contexts (composition, sources, etc.).

Run from repo root:
    python3 scripts/migrate-variants-shape.py --dry-run
    python3 scripts/migrate-variants-shape.py
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GLOB = ROOT / 'content' / 'components'
VARIANTS_HEADER = re.compile(r'^  variants:\s*$')
BARE_ITEM = re.compile(r'^    -\s+([\w-]+)\s*$')
NEXT_BLOCK = re.compile(r'^  [a-zA-Z]')  # next axes-level field starts column 2


def migrate(path: Path) -> tuple[int, list[str]]:
    """Return (n_lines_changed, new_text_lines). 0 changes => idempotent skip."""
    src = path.read_text(encoding='utf-8').splitlines(keepends=True)
    out: list[str] = []
    in_variants = False
    changed = 0
    for line in src:
        if in_variants and NEXT_BLOCK.match(line):
            in_variants = False
        if VARIANTS_HEADER.match(line):
            in_variants = True
            out.append(line)
            continue
        if in_variants:
            m = BARE_ITEM.match(line)
            if m:
                name = m.group(1)
                out.append(f'    - name: {name}\n')
                changed += 1
                continue
        out.append(line)
    return changed, out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='print plan without writing')
    args = ap.parse_args()
    files = sorted(GLOB.glob('*.yaml'))
    if not files:
        print(f'no yamls found under {GLOB}', file=sys.stderr)
        return 1
    total_changed = 0
    touched_files = 0
    for path in files:
        n, new_lines = migrate(path)
        if n == 0:
            continue
        rel = path.relative_to(ROOT)
        print(f'{rel}: {n} variant entries')
        total_changed += n
        touched_files += 1
        if not args.dry_run:
            path.write_text(''.join(new_lines), encoding='utf-8')
    suffix = ' (dry-run)' if args.dry_run else ''
    print(f'\n{touched_files} file(s), {total_changed} variant entries migrated{suffix}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
