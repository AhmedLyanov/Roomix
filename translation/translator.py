from transformers import MarianMTModel, MarianTokenizer

MODELS = {}

MODEL_MAP = {
    ("ru", "en"): "Helsinki-NLP/opus-mt-ru-en",
    ("en", "ru"): "Helsinki-NLP/opus-mt-en-ru",
}


def get_translator(source: str, target: str):
    key = (source, target)

    if key not in MODELS:
        model_name = MODEL_MAP[key]

        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)

        MODELS[key] = (tokenizer, model)

    return MODELS[key]


def translate(text: str, source: str, target: str):

    tokenizer, model = get_translator(source, target)

    inputs = tokenizer(text, return_tensors="pt")

    translated = model.generate(**inputs)

    return tokenizer.decode(
        translated[0],
        skip_special_tokens=True,
    )