from transformers import MarianMTModel, MarianTokenizer
import logging

logger = logging.getLogger(__name__)

MODELS = {}

MODEL_MAP = {
    ("ru", "en"): "Helsinki-NLP/opus-mt-ru-en",
    ("en", "ru"): "Helsinki-NLP/opus-mt-en-ru",
}


def get_translator(source: str, target: str):
    key = (source, target)

    if key not in MODELS:
        if key not in MODEL_MAP:
            logger.error(f"No translation model for {source} -> {target}")
            return None
        
        model_name = MODEL_MAP[key]
        logger.info(f"Loading model: {model_name}")

        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)

        MODELS[key] = (tokenizer, model)

    return MODELS[key]


def translate(text: str, source: str, target: str):
    if source == target:
        return text
    
    translator = get_translator(source, target)
    
    if translator is None:
        logger.warning(f"No translator for {source}->{target}, returning original")
        return text
    
    tokenizer, model = translator

    try:
        inputs = tokenizer(text, return_tensors="pt")
        translated = model.generate(**inputs)
        return tokenizer.decode(translated[0], skip_special_tokens=True)
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text