from fastapi import FastAPI

from translator import translate
from schemas import (
    TranslationRequest,
    TranslationResponse,
)

app = FastAPI(
    title="Merryweather Translation Service",
)


@app.post(
    "/translate",
    response_model=TranslationResponse,
)
def translate_text(request: TranslationRequest):

    result = translate(
        request.text,
        request.source,
        request.target,
    )

    return {
        "translation": result
    }