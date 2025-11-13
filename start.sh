#!/bin/bash
# Render startup script
pip install -r requirements.txt
gunicorn server:app
