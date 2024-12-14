from metadata.image_processor import generate_image_description
from metadata.link_processor import extract_text_from_url
from embeddings.embedding_generator import generate_embedding, calculate_similarity
from scoring.relevance_scorer import calculate_relevance_score
from transformers import pipeline
import numpy as np

def process_comment(comment, image_urls=None, links=None):
    text_embedding = generate_embedding(comment)

    # Initialize the caption generator
    caption_generator = pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")

    # Process images
    image_scores = []
    if image_urls:
        for url in image_urls:
            metadata = generate_image_description(url, caption_generator)
            if metadata and metadata['description']:
                image_emb = generate_embedding(metadata['description'])
                image_scores.append(calculate_similarity(text_embedding, image_emb))

    # Process links
    link_scores = []
    if links:
        for link in links:
            metadata = extract_text_from_url(link)
            if metadata and metadata['content']:
                link_emb = generate_embedding(metadata['content'])
                link_scores.append(calculate_similarity(text_embedding, link_emb))

    # Combine scores
    image_embedding = max(image_scores, default=None)
    link_embedding = max(link_scores, default=None)
    
    final_score = calculate_relevance_score(
        text_embedding,
        image_embedding=image_embedding if image_embedding is not None else np.zeros_like(text_embedding),
        link_embedding=link_embedding if link_embedding is not None else np.zeros_like(text_embedding)
    )
    return final_score

if __name__ == "__main__":
    comment = "This comment addresses layout issues in the UI."
    image_urls = ["https://www.bing.com/th?id=OADD2.7490516793165_1K4Y6UMUPT5JEHB4D8&pid=21.2&c=16&roil=0&roit=0.033&roir=1&roib=0.8186&w=300&h=157&dynsize=1&qlt=90"]
    links = ["https://example.com/sample-page"]

    score = process_comment(comment, image_urls, links)
    print(f"Final Relevance Score: {score}")