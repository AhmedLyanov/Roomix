from pydantic import BaseModel


class TranslationRequest(BaseModel):
    text: str
    source: str
    target: str


class TranslationResponse(BaseModel):
    translation: str