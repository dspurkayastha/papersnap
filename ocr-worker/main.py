from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

app = FastAPI(title="PaperSnap OCR Worker", version="0.1.0")


def run_google_vision_stub(_image_bytes: bytes) -> str:
    return "GoogleVision OCR: Diagnosis Perforation peritonitis; Procedure Emergency laparotomy"


def run_chandra_stub(_image_bytes: bytes) -> str:
    return "Chandra OCR: Patient age 45; Surgeon Dr Example; Emergency laparotomy performed"


def run_deepseek_stub(_image_bytes: bytes) -> str:
    return "DeepSeek OCR: Emergency laparotomy with Graham's patch for perforation peritonitis"


@app.post("/analyze")
async def analyze(documentId: str = Form(...), file: UploadFile = File(...)) -> JSONResponse:
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise ValueError("Empty file uploaded")

        google_text = run_google_vision_stub(image_bytes)
        chandra_text = run_chandra_stub(image_bytes)
        deepseek_text = run_deepseek_stub(image_bytes)

        raw_text = "\n".join([google_text, chandra_text, deepseek_text])

        response: Dict[str, Any] = {
            "documentId": documentId,
            "rawText": raw_text,
            "fields": {
                "surgeryDate": {"value": "2025-11-08", "confidence": 0.9},
                "patientAge": {"value": 45, "confidence": 0.85},
                "patientSex": {"value": "F", "confidence": 0.9},
                "diagnosis": {"value": "Perforation peritonitis", "confidence": 0.9},
                "procedure": {
                    "value": "Emergency laparotomy with Graham's patch",
                    "confidence": 0.88,
                },
                "surgeon": {"value": "Dr Example", "confidence": 0.7},
                "emergencyFlag": {"value": True, "confidence": 0.95},
            },
            "blocks": [
                {
                    "id": "b1",
                    "bbox": [0, 0, 100, 20],
                    "text": "Perforation peritonitis",
                    "engineVotes": {
                        "google": "Perforation peritonitis",
                        "chandra": "Perforation peritonitis",
                        "deepseek": "Perforation peritonitis",
                    },
                }
            ],
        }

        return JSONResponse(content=response)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Failed to process OCR for document %s", documentId)
        raise HTTPException(status_code=500, detail="OCR processing failed") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001)
