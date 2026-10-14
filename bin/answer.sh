#!/usr/bin/env bash
# Opens the answer session: the agent asks you every escalation question that is waiting, and
# writes your answers to answer files. Answered tickets resume as soon as the session ends.
set -euo pipefail
WF=/workspace/workflow
"$WF/bin/bootstrap.sh"
cd /workspace/data
"$WF/bin/agent" interactive --prompt "/answer" || true   # resume what was answered, however it ended
"$WF/bin/check-feedback.sh"       # resume the answered tickets right away
