import time

from transformers import MarianMTModel, MarianTokenizer

MODEL_NAME = "Helsinki-NLP/opus-mt-ru-en"

print("Загружаю модель...")

tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
model = MarianMTModel.from_pretrained(MODEL_NAME)

print("Модель успешно загружена!")

text = "чатгпт самый крутой в мире!"

inputs = tokenizer(text, return_tensors="pt")

start = time.perf_counter()

translated = model.generate(**inputs)

translation = tokenizer.decode(translated[0], skip_special_tokens=True)

end = time.perf_counter()

print("\nИсходный текст:")
print(text)

print("\nПеревод:")
print(translation)

print(f"\nВремя перевода: {(end - start) * 1000:.2f} ms")
