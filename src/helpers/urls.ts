function getBaseUrl(url: string) {
  try {
    const urlObject = new URL(url);
    return `${urlObject.protocol}//${urlObject.host}${urlObject.pathname}`;
  } catch {
    return url;
  }
}

export function areBaseUrlsEqual(url1: string, url2: string) {
  return getBaseUrl(url1) === getBaseUrl(url2);
}
