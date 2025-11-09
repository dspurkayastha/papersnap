from __future__ import annotations

import json
import logging
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="PaperSnap OCR Worker", version="0.2.0")


# -------------------------------------------------------------------
# Helpers / config
# -------------------------------------------------------------------

def env_bool(name: str, default: bool) -> bool:
  value = os.getenv(name)
  if value is None:
    return default
  return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class EngineState:
  id: str
  name: str
  enabled: bool
  available: bool
  reason: Optional[str] = None


class AnalyzeRequest(BaseModel):
  file_path: str = Field(..., alias="file_path")
  document_id: Optional[str] = Field(default=None, alias="documentId")


class EngineToggleRequest(BaseModel):
  enabled: bool


EngineStates = Dict[str, EngineState]


def _initial_engine_states() -> EngineStates:
  return {
    "chandra": EngineState(
      id="chandra",
      name="Chandra",
      enabled=env_bool("OCR_ENGINE_CHANDRA_ENABLED", True),
      available=False,
    ),
    "surya": EngineState(
      id="surya",
      name="Surya",
      enabled=env_bool("OCR_ENGINE_SURYA_ENABLED", True),
      available=False,
    ),
    "gcv": EngineState(
      id="gcv",
      name="Google Cloud Vision",
      enabled=env_bool("OCR_ENGINE_GCV_ENABLED", False),
      available=False,
    ),
    "deepseek": EngineState(
      id="deepseek",
      name="DeepSeek-OCR",
      enabled=bool(os.getenv("DEEPSEEK_OCR_URL")),
      available=False,
    ),
    "stub": EngineState(
      id="stub",
      name="Stub",
      enabled=env_bool("ALLOW_STUB_OCR", True),
      available=True,
    ),
  }


def _serialize_engine_state(state: EngineState) -> Dict[str, Any]:
  return {
    "id": state.id,
    "name": state.name,
    "enabled": state.enabled,
    "available": state.available,
    "reason": state.reason,
  }


def _load_module(module_name: str) -> Tuple[bool, Optional[str]]:
  try:
    __import__(module_name)
    return True, None
  except Exception as exc:  # pragma: no cover - depends on runtime env
    return False, f"Import error: {exc}"


# -------------------------------------------------------------------
# Engine detection
# -------------------------------------------------------------------

def _detect_chandra() -> Tuple[bool, Optional[str]]:
  # pip install chandra-ocr → import chandra
  return _load_module("chandra")


def _detect_surya() -> Tuple[bool, Optional[str]]:
  # pip install surya-ocr → import surya
  return _load_module("surya")


def _detect_gcv() -> Tuple[bool, Optional[str]]:
  available, reason = _load_module("google.cloud.vision")
  if not available:
    return available, reason
  credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
  if not credentials or not Path(credentials).exists():
    return False, "GOOGLE_APPLICATION_CREDENTIALS not set or file missing"
  return True, None


def _detect_deepseek() -> Tuple[bool, Optional[str]]:
  url = os.getenv("DEEPSEEK_OCR_URL")
  if not url:
    return False, "DEEPSEEK_OCR_URL not configured"
  try:
    health_url = url.rstrip("/") + "/health"
    response = requests.get(health_url, timeout=3)
    if response.status_code >= 400:
      return False, f"Health check failed ({response.status_code})"
  except requests.RequestException as exc:
    logger.warning("DeepSeek health probe failed: %s", exc)
    return False, f"Health probe failed: {exc}"
  return True, None


ENGINE_DETECTORS = {
  "chandra": _detect_chandra,
  "surya": _detect_surya,
  "gcv": _detect_gcv,
  "deepseek": _detect_deepseek,
  "stub": lambda: (True, None),
}

# Order in which we try engines when fusing
ENGINE_ORDER = ["chandra", "surya", "gcv", "deepseek"]

engine_states: EngineStates = _initial_engine_states()


def refresh_engine_states() -> None:
  for engine_id, state in engine_states.items():
    detector = ENGINE_DETECTORS.get(engine_id)
    if not detector:
      continue
    available, reason = detector()
    state.available = available
    state.reason = reason


# -------------------------------------------------------------------
# Common utilities
# -------------------------------------------------------------------

def ensure_jsonable(value: Any) -> Any:
  try:
    json.dumps(value)
    return value
  except TypeError:
    if isinstance(value, dict):
      return {k: ensure_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
      return [ensure_jsonable(v) for v in value]
    return str(value)


def extract_text_from_output(output: Any) -> str:
  if output is None:
    return ""
  if isinstance(output, str):
    return output

  if isinstance(output, dict):
    for key in ("text", "raw_text", "rawText", "content"):
      if key in output and output[key]:
        return str(output[key])

  if isinstance(output, (list, tuple)):
    return "\n".join(str(item) for item in output if item)

  for attr in ("text", "raw_text", "rawText"):
    if hasattr(output, attr):
      value = getattr(output, attr)
      if value:
        return str(value)

  if hasattr(output, "to_json"):
    try:
      data = output.to_json()
      if isinstance(data, str):
        return extract_text_from_output(json.loads(data))
      return extract_text_from_output(data)
    except Exception:
      pass

  if hasattr(output, "to_dict"):
    try:
      data = output.to_dict()
      return extract_text_from_output(data)
    except Exception:
      pass

  return str(output)


# -------------------------------------------------------------------
# Engine runners
# -------------------------------------------------------------------

def run_chandra(file_path: Path) -> Optional[Dict[str, Any]]:
  state = engine_states.get("chandra")
  if not (state and state.enabled and state.available):
    return None

  try:
    import chandra  # type: ignore

    # Prefer a direct python API if available
    output: Any = None

    if hasattr(chandra, "ocr") and callable(getattr(chandra, "ocr")):
      # hypothetical high-level API
      output = chandra.ocr(str(file_path))  # type: ignore[misc]
    else:
      # Fallback: use the CLI as documented in repo
      proc = subprocess.run(
        ["chandra", str(file_path)],
        capture_output=True,
        text=True,
        timeout=300,
      )
      if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "chandra cli failed")
      output = proc.stdout

    text = extract_text_from_output(output)
    if not text.strip():
      return None

    meta = ensure_jsonable(output)
    return {"engine_id": "chandra", "text": text, "meta": {"raw": meta}}

  except Exception as exc:  # pragma: no cover - external dep / CLI
    logger.exception("Chandra OCR failed: %s", exc)
    return None


def run_surya(file_path: Path) -> Optional[Dict[str, Any]]:
  state = engine_states.get("surya")
  if not (state and state.enabled and state.available):
    return None

  try:
    import surya  # type: ignore

    output: Any = None

    # Try common patterns; adjust as Surya's API stabilizes.
    if hasattr(surya, "ocr") and callable(getattr(surya, "ocr")):
      output = surya.ocr(str(file_path))  # type: ignore[misc]
    elif hasattr(surya, "load") and callable(getattr(surya, "load")):
      model = surya.load()  # type: ignore[misc]
      if hasattr(model, "ocr"):
        output = model.ocr(str(file_path))  # type: ignore[misc]
    else:
      # Fallback CLI (if exposed by the package)
      proc = subprocess.run(
        ["surya-ocr", str(file_path)],
        capture_output=True,
        text=True,
        timeout=300,
      )
      if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "surya-ocr cli failed")
      output = proc.stdout

    text = extract_text_from_output(output)
    if not text.strip():
      return None

    meta = ensure_jsonable(output)
    return {"engine_id": "surya", "text": text, "meta": {"raw": meta}}

  except Exception as exc:  # pragma: no cover
    logger.exception("Surya OCR failed: %s", exc)
    return None


gcv_client = None


def run_gcv(file_path: Path) -> Optional[Dict[str, Any]]:
  global gcv_client
  state = engine_states.get("gcv")
  if not (state and state.enabled and state.available):
    return None

  try:
    from google.cloud import vision  # type: ignore
    from google.protobuf.json_format import MessageToDict  # type: ignore

    if gcv_client is None:
      gcv_client = vision.ImageAnnotatorClient()

    with file_path.open("rb") as f:
      content = f.read()

    image = vision.Image(content=content)
    response = gcv_client.document_text_detection(image=image)

    if response.error.message:
      raise RuntimeError(response.error.message)

    full_text = response.full_text_annotation.text if response.full_text_annotation else ""
    if not full_text.strip():
      return None

    response_meta = MessageToDict(response._pb, preserving_proto_field_name=True)  # type: ignore[attr-defined]
    meta = {
      "locale": (
        response.full_text_annotation.pages[0].property.detected_languages[0].language_code
        if response.full_text_annotation
        and response.full_text_annotation.pages
        and response.full_text_annotation.pages[0].property.detected_languages
        else None
      ),
      "raw": response_meta,
    }
    return {"engine_id": "gcv", "text": full_text, "meta": ensure_jsonable(meta)}

  except Exception as exc:  # pragma: no cover
    logger.exception("Google Cloud Vision OCR failed: %s", exc)
    return None


def run_deepseek(file_path: Path) -> Optional[Dict[str, Any]]:
  state = engine_states.get("deepseek")
  if not (state and state.enabled and state.available):
    return None

  url = os.getenv("DEEPSEEK_OCR_URL")
  if not url:
    return None

  try:
    with file_path.open("rb") as file_handle:
      files = {"file": (file_path.name, file_handle, "application/octet-stream")}
      response = requests.post(url.rstrip("/"), files=files, timeout=60)

    response.raise_for_status()
    data = response.json()
    text = data.get("text") or data.get("rawText") or ""
    if not text.strip():
      return None

    return {"engine_id": "deepseek", "text": text, "meta": ensure_jsonable(data)}

  except Exception as exc:  # pragma: no cover
    logger.exception("DeepSeek OCR failed: %s", exc)
    return None


ENGINE_RUNNERS = {
  "chandra": run_chandra,
  "surya": run_surya,
  "gcv": run_gcv,
  "deepseek": run_deepseek,
}


# -------------------------------------------------------------------
# Heuristic parsing & schema selection
# -------------------------------------------------------------------

SURGERY_KEYWORDS = [
  "diagnosis",
  "procedure",
  "surgeon",
  "laparotomy",
  "peritonitis",
  "ot note",
]


def normalize_whitespace(value: str) -> str:
  return re.sub(r"\s+", " ", value).strip()


def parse_surgery_fields(raw_text: str) -> Dict[str, Any]:
  fields: Dict[str, Any] = {}
  lower_text = raw_text.lower()

  def add_field(key: str, value: Optional[Any], confidence: float) -> None:
    if value is None:
      return
    fields[key] = {"value": value, "confidence": confidence}

  date_match = re.search(
    r"(?:surgery date|date of surgery|dos|operation date)[:\-\s]*"
    r"([0-9]{4}[\-/][0-9]{2}[\-/][0-9]{2}|[0-9]{2}[\-/][0-9]{2}[\-/][0-9]{4})",
    raw_text,
    flags=re.IGNORECASE,
  )
  if date_match:
    date_value = date_match.group(1).replace("/", "-")
    parts = date_value.split("-")
    if len(parts[0]) == 2:
      date_value = f"{parts[2]}-{parts[1]}-{parts[0]}"
    add_field("surgeryDate", date_value, 0.85)

  age_match = re.search(r"(?:age|patient age)\D*([0-9]{1,3})", raw_text, flags=re.IGNORECASE)
  if age_match:
    add_field("patientAge", int(age_match.group(1)), 0.8)

  sex_match = re.search(r"(?:sex|gender)\D*([MF]|male|female)", raw_text, flags=re.IGNORECASE)
  if sex_match:
    value = sex_match.group(1).upper()
    if value in {"MALE", "FEMALE"}:
      value = value[0]
    add_field("patientSex", value, 0.75)

  diagnosis_match = re.search(r"diagnosis[:\-\s]*([^\n]+)", raw_text, flags=re.IGNORECASE)
  if diagnosis_match:
    add_field("diagnosis", normalize_whitespace(diagnosis_match.group(1)), 0.9)

  procedure_match = re.search(r"procedure[:\-\s]*([^\n]+)", raw_text, flags=re.IGNORECASE)
  if procedure_match:
    add_field("procedure", normalize_whitespace(procedure_match.group(1)), 0.88)

  surgeon_match = re.search(r"surgeon[:\-\s]*([^\n]+)", raw_text, flags=re.IGNORECASE)
  if surgeon_match:
    add_field("surgeon", normalize_whitespace(surgeon_match.group(1)), 0.7)

  if "emergency" in lower_text:
    add_field("emergencyFlag", True, 0.9)

  return fields


def build_generic_fields(raw_text: str) -> Dict[str, Any]:
  summary = normalize_whitespace(raw_text)
  if len(summary) > 480:
    summary = summary[:480] + "..."
  return {"summary": {"value": summary, "confidence": 0.3}}


def infer_schema(raw_text: str) -> Tuple[str, Dict[str, Any]]:
  lower_text = raw_text.lower()
  if any(keyword in lower_text for keyword in SURGERY_KEYWORDS):
    fields = parse_surgery_fields(raw_text)
    return "surgery_note_v1", fields
  return "generic_v1", build_generic_fields(raw_text)


def fuse_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
  if not results:
    raise ValueError("No OCR results to fuse")

  raw_sections: List[str] = []
  engines_used: List[str] = []
  engine_meta: Dict[str, Any] = {}

  for result in results:
    engine_id = result.get("engine_id") or "unknown"
    engines_used.append(engine_id)

    text = (result.get("text") or "").strip()
    if text:
      raw_sections.append(f"[{engine_id.upper()}]\n{text}")

    meta = result.get("meta")
    if meta is not None:
      engine_meta[engine_id] = ensure_jsonable(meta)

  combined_raw = "\n\n".join(raw_sections).strip()
  schema_type, parsed_fields = infer_schema(combined_raw)

  return {
    "rawText": combined_raw,
    "schemaType": schema_type,
    "parsedFields": parsed_fields or None,
    "ocrMeta": {
      "enginesUsed": engines_used,
      "engineDetails": engine_meta,
    },
  }


# -------------------------------------------------------------------
# Stub fallback
# -------------------------------------------------------------------

def stub_payload(document_id: Optional[str]) -> Dict[str, Any]:
  raw_text = (
    "GoogleVision OCR: Diagnosis Perforation peritonitis; Procedure Emergency laparotomy\n"
    "Chandra OCR: Patient age 45; Surgeon Dr Example; Emergency laparotomy performed\n"
    "DeepSeek OCR: Emergency laparotomy with Graham's patch for perforation peritonitis"
  )
  parsed_fields = {
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
  }
  return {
    "rawText": raw_text,
    "schemaType": "demo_stub_v1",
    "parsedFields": parsed_fields,
    "ocrMeta": {
      "enginesUsed": ["stub"],
      "stub": {
        "documentId": document_id,
        "note": "Demo stub used because no primary OCR engines succeeded",
      },
    },
  }


# -------------------------------------------------------------------
# Orchestration
# -------------------------------------------------------------------

def collect_engine_results(file_path: Path) -> List[Dict[str, Any]]:
  results: List[Dict[str, Any]] = []
  for engine_id in ENGINE_ORDER:
    runner = ENGINE_RUNNERS.get(engine_id)
    state = engine_states.get(engine_id)
    if runner is None or state is None:
      continue
    if not state.enabled or not state.available:
      continue

    try:
      result = runner(file_path)
    except Exception as exc:  # pragma: no cover
      logger.exception("Engine %s raised unexpected exception: %s", engine_id, exc)
      result = None

    if result and result.get("text"):
      results.append(result)

  return results


# -------------------------------------------------------------------
# FastAPI endpoints
# -------------------------------------------------------------------

@app.on_event("startup")
async def on_startup() -> None:
  refresh_engine_states()


@app.get("/health")
async def health() -> JSONResponse:
  refresh_engine_states()
  return JSONResponse(
    {
      "status": "ok",
      "engines": [_serialize_engine_state(state) for state in engine_states.values()],
    }
  )


@app.get("/engines")
async def list_engines() -> JSONResponse:
  refresh_engine_states()
  return JSONResponse(
    {"engines": [_serialize_engine_state(state) for state in engine_states.values()]}
  )


@app.post("/engines/{engine_id}")
async def toggle_engine(engine_id: str, payload: EngineToggleRequest) -> JSONResponse:
  state = engine_states.get(engine_id)
  if not state:
    raise HTTPException(status_code=404, detail="Engine not found")

  if engine_id == "stub" and not payload.enabled:
    logger.warning("Disabling stub OCR removes fallback coverage")

  state.enabled = payload.enabled
  # Re-check availability when toggled
  detector = ENGINE_DETECTORS.get(engine_id)
  if detector:
    available, reason = detector()
    state.available = available
    state.reason = reason

  return await list_engines()


@app.post("/analyze")
async def analyze(request: AnalyzeRequest) -> JSONResponse:
  file_path = Path(request.file_path).expanduser().resolve()

  if not file_path.exists() or not file_path.is_file():
    raise HTTPException(status_code=400, detail="file_path does not exist or is not a file")

  refresh_engine_states()

  results = await run_in_threadpool(collect_engine_results, file_path)

  if not results:
    stub_state = engine_states.get("stub")
    if stub_state and stub_state.enabled:
      logger.info(
        "Falling back to stub OCR for %s",
        request.document_id or file_path.name,
      )
      return JSONResponse(content=stub_payload(request.document_id))

    raise HTTPException(status_code=500, detail="No OCR engines available")

  fused = fuse_results(results)
  return JSONResponse(content=fused)


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8001")))
