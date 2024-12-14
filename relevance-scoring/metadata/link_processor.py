import requests
from bs4 import BeautifulSoup
import json

def extract_text_from_url(link, char_limit=500):
    try:
        response = requests.get(link)
        response.raise_for_status()
        
        # Check if the content type is HTML
        if 'text/html' not in response.headers.get('Content-Type', ''):
            return {
                "url": link,
                "content": "Error: URL does not point to an HTML page."
            }
        
        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove script and style elements
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()

        # Extract text
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        content = '\n'.join(line for line in lines if line)
        
        # Limit content size
        if len(content) > char_limit:
            content = content[:char_limit] + '...'
        
        # Extract metadata
        title = soup.title.string if soup.title else "No title found"
        description_tag = soup.find('meta', attrs={"name": "description"})
        description = description_tag['content'] if description_tag else "No description found"
        
        return {
            "url": link,
            "title": title,
            "description": description,
            "content": content
        }
    except requests.RequestException as e:
        return {
            "url": link,
            "content": f"Error extracting content: {str(e)}"
        }

if __name__ == "__main__":
    # Replace with a valid HTML page URL for testing
    link = "https://www.msn.com/en-xl/news/other/nato-fighters-are-scrambled-as-putin-launches-major-attack/ar-AA1vN9Tw?ocid=msedgntp&pc=U531&cvid=e46b01e433d144faa6fab2b226dca294&ei=29"
    metadata = extract_text_from_url(link)
    print(json.dumps(metadata, indent=4))

    # Save the processed metadata to a file
    with open("metadata.json", "w") as file:
        json.dump(metadata, file)