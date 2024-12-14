import requests
from PIL import Image
from io import BytesIO
from transformers import pipeline
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)

def generate_image_description(image_url, caption_generator):
    try:
        logging.info(f"Fetching image from URL: {image_url}")
        
        # Download the image
        response = requests.get(image_url)
        if response.status_code != 200:
            raise Exception(f"Failed to retrieve image. Status code: {response.status_code}")
        
        # Check the content type of the response
        content_type = response.headers.get('Content-Type')
        logging.info(f"Content-Type: {content_type}")
        if 'image' not in content_type:
            raise Exception(f"URL does not point to an image. Content-Type: {content_type}")
        
        # Print the first few bytes of the response content for debugging
        logging.info(f"Response content (first 100 bytes): {response.content[:100]}")
        
        # Load the image
        image = Image.open(BytesIO(response.content))
        
        # Generate the description
        description = caption_generator(image)[0]['generated_text']
        
        return {
            "url": image_url,
            "description": description
        }
    except Exception as e:
        logging.error(f"Error processing image {image_url}: {e}")
        return {
            "url": image_url,
            "description": None
        }

if __name__ == "__main__":
    # Initialize the image captioning model inside the main block
    caption_generator = pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")
    
    # Sample image URL
    image_url = "https://th.bing.com/th?id=ORMS.99706f16f78dd7e84c31c95eef897656&pid=Wdp&w=268&h=140&qlt=90&c=1&rs=1&dpr=1.5&p=0"
    # Generate and print metadata
    metadata = generate_image_description(image_url, caption_generator)
    print(metadata)