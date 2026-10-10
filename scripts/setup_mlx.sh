#!/usr/bin/env bash

# setup_mlx.sh
# Detects if a suitable MLX model is available, installs MLX if necessary,
# and starts the MLX server with an official Google Gemma model.

set -e

MODEL_NAME="google/gemma-2-2b-it"

echo "Checking system architecture..."
if [[ "$(uname -s)" != "Darwin" ]] || [[ "$(uname -m)" != "arm64" ]]; then
    echo "Warning: MLX is optimized for macOS on Apple Silicon. You are running $(uname -s) on $(uname -m)."
    echo "You may encounter issues if not on Apple Silicon."
fi

echo "Checking for Python 3..."
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3 and try again."
    kill -INT $$
fi

echo "Checking for pip3..."
if ! command -v pip3 &> /dev/null; then
    echo "Error: pip3 is not installed. Please install pip and try again."
    kill -INT $$
fi

echo "Checking if mlx-lm is installed..."
if ! python3 -c 'import mlx_lm' &> /dev/null; then
    echo "mlx-lm is not installed. Installing..."
    pip3 install mlx-lm huggingface_hub
else
    echo "mlx-lm is already installed."
fi

echo ""
echo "====================================================================="
echo "Note: The Google Gemma model is a gated model on Hugging Face."
echo "If you haven't already, please authenticate with Hugging Face:"
echo "  1. huggingface-cli login"
echo "You also need to accept the terms of the Gemma model at:"
echo "  https://huggingface.co/google/gemma-2-2b-it"
echo "====================================================================="
echo ""

echo "Checking if the model is available locally in the Hugging Face cache..."
cat << 'PYEOF' > .check_model.py
import sys
try:
    from huggingface_hub import snapshot_download
    snapshot_download("google/gemma-2-2b-it", local_files_only=True)
    print("Available")
except Exception:
    print("Not Available")
PYEOF

STATUS=$(python3 .check_model.py || echo "Not Available")
rm -f .check_model.py

if [ "$STATUS" = "Available" ]; then
    echo "Suitable MLX model ($MODEL_NAME) is already available locally."
else
    echo "Model $MODEL_NAME is not found locally. It will be downloaded."
    echo "Please ensure you have authenticated with Hugging Face."
fi

echo "Starting MLX server with model: $MODEL_NAME"
echo "Command: python3 -m mlx_lm.server --model $MODEL_NAME"
python3 -m mlx_lm.server --model "$MODEL_NAME"
