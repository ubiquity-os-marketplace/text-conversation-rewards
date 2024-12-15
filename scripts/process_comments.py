import os
import requests
from github import Github
from relavance_scoring.metadata.image_processor import generate_image_description
from relavance_scoring.metadata.link_processor import extract_text_from_url
from relavance_scoring.embeddings.embedding_generator import generate_embedding, calculate_similarity
from relavance_scoring.scoring.relevance_scorer import calculate_relevance_score
from transformers import pipeline

# Initialize GitHub client
g = Github(os.getenv('GITHUB_TOKEN'))
repo = g.get_repo(os.getenv('GITHUB_REPOSITORY'))
issue_number = os.getenv('ISSUE_NUMBER')
comment_id = os.getenv('COMMENT_ID')

# Fetch the comment
issue = repo.get_issue(number=int(issue_number))
comment = issue.get_comment(int(comment_id))

# Process the comment
def process_comment(comment_body, image_urls=None, links=None):
    text_embedding = generate_embedding(comment_body)

    # Initialize the caption generator
    caption_generator = pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")

    # Process images
    image_scores = []
    if image_urls:
        for url in image_urls:
            description = generate_image_description(url, caption_generator)
            description_embedding = generate_embedding(description)
            similarity_score = calculate_similarity(text_embedding, description_embedding)
            image_scores.append(similarity_score)

    # Process links
    link_scores = []

    if links:
        for link in links:
            link_text = extract_text_from_url(link)
            link_text_embedding = generate_embedding(link_text)
            similarity_score = calculate_similarity(text_embedding, link_text_embedding)
            link_scores.append(similarity_score)

    # Calculate relevance score
    relevance_score = calculate_relevance_score(text_embedding, image_scores, link_scores)
    return relevance_score

# Update the comment with the relevance score

comment.edit(body=f"{comment.body}\n\n<!-- Relevance Score: {relevance_score} -->")