"""Exercise the launcher with fake interpreters; never start a bot or install packages."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


FAKE_INTERPRETER = r'''
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

args = sys.argv[1:]
with open(os.environ['LAUNCHER_TEST_LOG'], 'a') as log:
    log.write(json.dumps([sys.argv[0], *args]) + '\n')
if args[:2] == ['-m', 'venv']:
    target = Path(args[2]) / 'bin' / 'python'
    target.parent.mkdir(parents=True)
    shutil.copyfile(__file__, target)
    target.chmod(0o755)
elif args[:2] == ['-m', 'pip']:
    Path(os.environ['LAUNCHER_TEST_REQUIREMENTS']).write_text(sys.stdin.read())
    sys.exit(int(os.environ.get('LAUNCHER_TEST_PIP_FAILURE', '0')))
elif args == ['-']:
    sys.exit(subprocess.run([sys.executable, '-'], input=sys.stdin.read(), text=True).returncode)
elif args and args[0] == '-c':
    if 'version_info' in args[1]:
        sys.exit(int(os.environ.get('LAUNCHER_TEST_OLD_PYTHON', '0')))
    sys.exit(int(os.environ.get('LAUNCHER_TEST_MISSING_DEPS', '0')))
'''


class LauncherTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='bot launcher ')
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        repo = Path(__file__).resolve().parents[1]
        shutil.copyfile(repo / 'start.sh', self.root / 'start.sh')
        shutil.copyfile(repo / 'pyproject.toml', self.root / 'pyproject.toml')
        self.bin = self.root / 'tools'
        self.bin.mkdir()
        (self.bin / 'dirname').symlink_to(shutil.which('dirname'))
        self.write_interpreter(self.bin / 'python3')
        self.log = self.root / 'calls.jsonl'
        self.requirements = self.root / 'requirements.txt'
        self.env = {
            **os.environ,
            'PATH': str(self.bin),
            'LAUNCHER_TEST_LOG': str(self.log),
            'LAUNCHER_TEST_REQUIREMENTS': str(self.requirements),
            'LAUNCHER_TEST_MISSING_DEPS': '1',
        }

    def write_interpreter(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'#!{sys.executable}\n' + FAKE_INTERPRETER)
        path.chmod(0o755)

    def run_launcher(self, *args):
        return subprocess.run(['/bin/bash', str(self.root / 'start.sh'), *args],
                              cwd='/', env=self.env, text=True, capture_output=True, timeout=15)

    def calls(self):
        return [json.loads(line)[1:] for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_bootstrap_installs_declared_dependencies_then_launches(self):
        result = self.run_launcher()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(['-m', 'venv', str(self.root / 'backend' / 'venv')], self.calls())
        self.assertIn('python-telegram-bot', self.requirements.read_text())
        self.assertNotIn('Flask', self.requirements.read_text())
        self.assertEqual(self.calls()[-1], ['-m', 'backend.memory_bot'])

    def test_setup_only_never_launches(self):
        result = self.run_launcher('--setup')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.requirements.exists())
        self.assertNotIn(['-m', 'backend.memory_bot'], self.calls())
        self.assertIn('No bot was started', result.stdout)

    def test_existing_healthy_environment_skips_install(self):
        self.write_interpreter(self.root / 'venv' / 'bin' / 'python')
        self.env['LAUNCHER_TEST_MISSING_DEPS'] = '0'
        result = self.run_launcher()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.requirements.exists())
        self.assertEqual(self.calls()[-1], ['-m', 'backend.memory_bot'])

    def test_backend_environment_is_preferred_over_root_and_poetry(self):
        backend_python = self.root / 'backend' / 'venv' / 'bin' / 'python'
        self.write_interpreter(backend_python)
        self.write_interpreter(self.root / 'venv' / 'bin' / 'python')
        self.write_interpreter(self.bin / 'poetry')
        self.env['LAUNCHER_TEST_MISSING_DEPS'] = '0'
        result = self.run_launcher()
        self.assertEqual(result.returncode, 0, result.stderr)
        invocations = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertTrue(all(call[0] == str(backend_python) for call in invocations))
        self.assertFalse(self.requirements.exists())
        self.assertEqual(self.calls()[-1], ['-m', 'backend.memory_bot'])

    def test_failed_install_can_be_retried_without_launching(self):
        self.env['LAUNCHER_TEST_PIP_FAILURE'] = '1'
        result = self.run_launcher()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(['-m', 'backend.memory_bot'], self.calls())
        self.env['LAUNCHER_TEST_PIP_FAILURE'] = '0'
        result = self.run_launcher('--setup')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(['-m', 'backend.memory_bot'], self.calls())

    def test_poetry_setup_uses_no_root(self):
        self.write_interpreter(self.bin / 'poetry')
        result = self.run_launcher('--setup')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [['install', '--no-root']])

    def test_old_python_explains_requirement(self):
        self.env['LAUNCHER_TEST_OLD_PYTHON'] = '1'
        result = self.run_launcher()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Python 3.12 or newer', result.stdout)
        self.assertFalse((self.root / 'backend' / 'venv').exists())

    def test_unknown_argument_does_not_launch(self):
        result = self.run_launcher('--unknown')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.calls(), [])


if __name__ == '__main__':
    unittest.main()
