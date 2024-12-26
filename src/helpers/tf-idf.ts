import natural from "natural";
import { AllComments } from "../types/content-evaluator-module-type";

export class TfIdf {
  private _tfidf: natural.TfIdf;

  constructor() {
    this._tfidf = new natural.TfIdf();
  }

  private _preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  public calculateSimilarity(text1: string, text2: string): number {
    this._tfidf = new natural.TfIdf();
    const processed1 = this._preprocessText(text1);
    const processed2 = this._preprocessText(text2);

    this._tfidf.addDocument(processed1);
    this._tfidf.addDocument(processed2);

    const vector1 = this._tfidf.listTerms(0);
    const vector2 = this._tfidf.listTerms(1);

    const terms = new Set([...vector1.map((v) => v.term), ...vector2.map((v) => v.term)]);

    const v1: number[] = [];
    const v2: number[] = [];

    terms.forEach((term) => {
      const term1 = vector1.find((v) => v.term === term);
      const term2 = vector2.find((v) => v.term === term);
      v1.push(term1 ? term1.tfidf : 0);
      v2.push(term2 ? term2.tfidf : 0);
    });

    const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
    const magnitude1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  getTopComments(specification: string, comments: AllComments, limit = 10) {
    return comments
      .map((comment) => {
        return { similarity: this.calculateSimilarity(specification, comment.comment), comment };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}
