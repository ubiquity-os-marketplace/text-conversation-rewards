from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Load the pre-trained model
model = SentenceTransformer('all-MiniLM-L6-v2')

def generate_embedding(text):
    """
    Generate embedding for a given text using the pre-trained model.
    """
    return model.encode(text)

def calculate_similarity(embedding1, embedding2):
    """
    Calculate cosine similarity between two embeddings.
    """
    return cosine_similarity([embedding1], [embedding2])[0][0]

if __name__ == "__main__":
    # Example texts
    text1 = "a UI with red lines on the side showing a spacing issue"
    text2 = "an issue with layout spacing in the UI"

    # Generate embeddings
    emb1 = generate_embedding(text1)
    emb2 = generate_embedding(text2)

    # Calculate similarity
    similarity = calculate_similarity(emb1, emb2)

    # Print the similarity score
    print(f"Similarity: {similarity:.2f}")