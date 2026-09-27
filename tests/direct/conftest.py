import os
import sys

# gltest direct mode unlinks a temp file that is still open as stdin, which
# Windows forbids. Ignore that PermissionError so tests run on Windows too.
if sys.platform == "win32":
    _unlink = os.unlink

    def _safe_unlink(path, *args, **kwargs):
        try:
            _unlink(path, *args, **kwargs)
        except PermissionError:
            pass

    os.unlink = _safe_unlink


# The direct VM refreshes sender/value in gl.message_raw but not the tx
# datetime, which the contract reads for deadlines. Keep it in sync on warp().
from gltest.direct.vm import VMContext  # noqa: E402

_refresh = VMContext._refresh_gl_message


def _refresh_with_datetime(self):
    _refresh(self)
    gl = sys.modules.get("genlayer.gl")
    if gl is not None and getattr(gl, "message_raw", None) is not None:
        gl.message_raw["datetime"] = self._datetime


VMContext._refresh_gl_message = _refresh_with_datetime
