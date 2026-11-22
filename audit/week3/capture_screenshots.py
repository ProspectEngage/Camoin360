"""Capture the sample preview; start preview-server.cjs separately after building."""
import pathlib
import subprocess
import tempfile

chrome = pathlib.Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
out = pathlib.Path(__file__).parent / 'screenshots'
out.mkdir(exist_ok=True)
views = ['sales-outlook', 'sales-outlook-rfp', 'contract-backlog-selected', 'rfp-overall-success-rate', 'service-line-financials']
captures = [(view, 'ready', 1440, 1600) for view in views]
captures += [(view, 'ready', 390, 1900) for view in views]
captures += [('sales-outlook-rfp', state, 1440, 1100) for state in ['loading', 'empty', 'error']]
for view, state, width, height in captures:
    name = f'{view}-{state}-{"mobile" if width == 390 else "desktop"}.png'
    with tempfile.TemporaryDirectory(prefix='chart-review-') as profile:
        result = subprocess.run([
            str(chrome), '--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
            '--no-default-browser-check', f'--user-data-dir={profile}',
            f'--window-size={width},{height}', '--virtual-time-budget=8000',
            f'--screenshot={out.resolve() / name}',
            f'http://127.0.0.1:8765/management/{view}?state={state}',
        ], capture_output=True, text=True, timeout=40)
        if result.returncode:
            raise RuntimeError(f"Chrome exited {result.returncode}: {result.stderr[-2000:]}")
    print(name, flush=True)
