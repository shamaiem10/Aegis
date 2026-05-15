"""Gemini / Vertex AI Client for Antigravity Orchestration."""

from __future__ import annotations

import json
import logging
from typing import Any, Type

from pydantic import BaseModel

from config import get_settings

logger = logging.getLogger(__name__)


async def call_antigravity(prompt: str, response_schema: Type[BaseModel] | None = None) -> Any:
    """
    Call Gemini LLM with an optional Pydantic schema for structured JSON output.
    """
    settings = get_settings()
    
    if not settings.gemini_api_key and not settings.google_cloud_project:
        logger.warning("No Gemini API key or GCP project found.")
        return None

    try:
        if settings.gemini_api_key:
            import google.generativeai as genai

            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(settings.gemini_model)
            
            kwargs = {}
            if response_schema:
                kwargs["generation_config"] = {"response_mime_type": "application/json", "response_schema": response_schema}
                
            resp = model.generate_content(prompt, **kwargs)
            
            raw = (resp.text or "").strip()
            if not raw:
                return None
                
            if response_schema:
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    logger.error("Failed to parse JSON from Gemini response.")
                    return None
            return raw

        elif settings.google_genai_use_vertexai:
            import vertexai
            from vertexai.generative_models import GenerativeModel, GenerationConfig

            vertexai.init(
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
            )
            model = GenerativeModel(settings.gemini_model)
            
            kwargs = {}
            if response_schema:
                kwargs["generation_config"] = GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema.model_json_schema()
                )
                
            resp = await model.generate_content_async(prompt, **kwargs)
            if not resp.candidates:
                return None
            parts = getattr(resp.candidates[0].content, "parts", None) or ()
            raw = "".join(getattr(p, "text", "") or "" for p in parts).strip()
            
            if not raw:
                return None
                
            if response_schema:
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return None
            return raw

    except Exception as e:
        logger.error("Antigravity call failed: %s", e)
        return None


async def classify_text_with_llm(text: str) -> str | None:
    """Structured crisis label via Antigravity/Gemini."""
    prompt = (
        "Classify the crisis described below into ONE label from: "
        "flood, fire, heatwave, civil_unrest, earthquake, disease_outbreak, "
        "accident, infrastructure, power_outage, other. "
        "Reply with ONLY the label, lowercase.\n\n"
        f"Signals:\n{text}"
    )
    res = await call_antigravity(prompt)
    if isinstance(res, str):
        picked = res.split()[0].lower().rstrip(".,;: ")
        return picked
    return None
