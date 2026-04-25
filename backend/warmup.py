from chromadb.utils import embedding_functions

print("Downloading embedding model... (one time only)")
ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)
ef(["warmup"])
print("Model ready.")
