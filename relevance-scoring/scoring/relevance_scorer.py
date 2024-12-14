from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)

def calculate_similarity(embedding1, embedding2):
    embedding1 = np.array(embedding1).reshape(1, -1)
    embedding2 = np.array(embedding2).reshape(1, -1)
    logging.info(f"Embedding1 shape: {embedding1.shape}")
    logging.info(f"Embedding2 shape: {embedding2.shape}")
    return cosine_similarity(embedding1, embedding2)[0][0]

def calculate_relevance_score(text_embedding, image_embedding=None, link_embedding=None):
    score = 0
    if image_embedding is not None:
        score += calculate_similarity(text_embedding, image_embedding) * 0.5  # Weight: 50%
    if link_embedding is not None:
        score += calculate_similarity(text_embedding, link_embedding) * 0.5  # Weight: 50%
    return score

if __name__ == "__main__":
    # Example usage
    def generate_embedding(text):
        # Placeholder function for generating embeddings
        # Replace this with your actual embedding generation logic
        return np.random.rand(768)

    text_emb = generate_embedding("a UI with layout issues")
    img_emb = generate_embedding("a UI with red lines showing a spacing issue")
    relevance_score = calculate_relevance_score(text_emb, image_embedding=img_emb)
    print(f"Relevance Score: {relevance_score:.2f}")