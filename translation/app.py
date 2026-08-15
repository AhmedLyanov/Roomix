from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import logging

from translator import translate
from schemas import (
    TranslationRequest,
    TranslationResponse,
)

# Константы
MIN_AUDIO_SIZE_BYTES = 3200
SILENCE_THRESHOLD = 0.015
SPEECH_CONFIDENCE_THRESHOLD = -2.0
NO_SPEECH_THRESHOLD = 0.5

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Roomix Speech & Translation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

whisper_model = None

@app.on_event("startup")
async def startup_event():
    global whisper_model
    logger.info("Initializing Whisper model...")
    
    try:
        from faster_whisper import WhisperModel
        
        whisper_model = WhisperModel(
            "small",
            device="cpu",
            compute_type="int8",
            num_workers=2,
            download_root="./models"
        )
        logger.info("Whisper model initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Whisper model: {e}")

@app.post("/translate", response_model=TranslationResponse)
def translate_text(request: TranslationRequest):
    try:
        result = translate(request.text, request.source, request.target)
        return {"translation": result}
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return {"translation": request.text}

@app.post("/speech-to-text")
async def speech_to_text(request: Request):
    if whisper_model is None:
        return {"text": "", "confidence": 0.0, "error": "Model not initialized"}
    
    try:
        audio_bytes = await request.body()
        
        if not audio_bytes or len(audio_bytes) < MIN_AUDIO_SIZE_BYTES:
            return {"text": "", "confidence": 0.0}
        
        audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_float = audio_array.astype(np.float32) / 32768.0
        
        if np.abs(audio_float).max() < SILENCE_THRESHOLD:
            return {"text": "", "confidence": 0.0}
        
        segments, info = whisper_model.transcribe(
            audio_float,
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            no_speech_threshold=NO_SPEECH_THRESHOLD,
        )
        
        full_text = ""
        total_confidence = 0.0
        segment_count = 0
        
        for segment in segments:
            if segment.avg_logprob > SPEECH_CONFIDENCE_THRESHOLD:
                full_text += segment.text + " "
                total_confidence += segment.avg_logprob
                segment_count += 1
        
        full_text = full_text.strip()
        avg_confidence = total_confidence / segment_count if segment_count > 0 else 0.0
        
        if full_text:
            logger.info(f"Recognized: '{full_text}' (confidence: {avg_confidence:.2f})")
        
        return {
            "text": full_text,
            "confidence": avg_confidence,
            "language": info.language if info else None,
        }
        
    except Exception as e:
        logger.error(f"Speech recognition error: {e}")
        return {"text": "", "confidence": 0.0, "error": str(e)}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": whisper_model is not None,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)