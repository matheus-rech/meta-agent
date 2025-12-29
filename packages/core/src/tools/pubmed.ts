/**
 * PubMed Tools
 * High-level interface for PubMed operations
 */

import { MCPClient } from '../mcp/client.js';

export interface SearchParams {
  query: string;
  subspecialty?: 'vascular' | 'oncology' | 'spine' | 'functional' | 'pediatric' | 'trauma';
  intervention?: string;
  outcome?: string;
  studyType?: 'rct' | 'meta' | 'sr' | 'cohort' | 'casecontrol' | 'all';
  years?: number;
  maxResults?: number;
}

export interface Article {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  abstract: string;
  publicationTypes: string[];
  url: string;
}

export interface SearchResult {
  total: number;
  query: string;
  articles: Article[];
}

export interface PICO {
  population: string;
  intervention: string;
  comparator?: string;
  outcome?: string;
}

export interface SearchStrategy {
  pico: PICO;
  strategies: {
    pubmed: string;
    embase: string;
    cochrane: string;
  };
  notes: string[];
}

export class PubMedTools {
  private mcp: MCPClient;
  
  constructor(mcp: MCPClient) {
    this.mcp = mcp;
  }
  
  /**
   * Search PubMed with neurosurgery-aware query building
   */
  async search(params: SearchParams): Promise<SearchResult> {
    return this.mcp.callTool('search_pubmed', {
      query: params.query,
      subspecialty: params.subspecialty,
      intervention: params.intervention,
      outcome: params.outcome,
      studyType: params.studyType || 'all',
      years: params.years || 10,
      maxResults: params.maxResults || 20,
    });
  }
  
  /**
   * Get full article details by PMID
   */
  async getArticle(pmid: string): Promise<Article> {
    return this.mcp.callTool('get_article', { pmid });
  }
  
  /**
   * Get articles that cite a given PMID
   */
  async getCitations(pmid: string, maxResults: number = 20): Promise<SearchResult> {
    return this.mcp.callTool('get_citations', { pmid, maxResults });
  }
  
  /**
   * Get related articles
   */
  async getRelated(pmid: string, maxResults: number = 10): Promise<SearchResult> {
    return this.mcp.callTool('get_related', { pmid, maxResults });
  }
  
  /**
   * Build comprehensive search strategy from PICO
   */
  async buildSearchStrategy(pico: PICO): Promise<SearchStrategy> {
    return this.mcp.callTool('build_search_strategy', pico);
  }
  
  /**
   * Search across multiple subspecialties
   */
  async multiSearch(
    baseQuery: string,
    subspecialties: string[],
    options: Omit<SearchParams, 'query' | 'subspecialty'> = {}
  ): Promise<Map<string, SearchResult>> {
    const results = new Map<string, SearchResult>();
    
    for (const subspecialty of subspecialties) {
      const result = await this.search({
        query: baseQuery,
        subspecialty: subspecialty as any,
        ...options,
      });
      results.set(subspecialty, result);
    }
    
    return results;
  }
  
  /**
   * Deduplicate articles from multiple searches
   */
  deduplicateResults(results: SearchResult[]): Article[] {
    const seen = new Set<string>();
    const unique: Article[] = [];
    
    for (const result of results) {
      for (const article of result.articles) {
        if (!seen.has(article.pmid)) {
          seen.add(article.pmid);
          unique.push(article);
        }
      }
    }
    
    return unique;
  }
  
  /**
   * Format search results as markdown
   */
  formatAsMarkdown(result: SearchResult): string {
    let output = `# PubMed Search Results\n\n`;
    output += `**Query:** \`${result.query}\`\n`;
    output += `**Total Results:** ${result.total}\n`;
    output += `**Retrieved:** ${result.articles.length}\n\n`;
    output += `---\n\n`;
    
    for (let i = 0; i < result.articles.length; i++) {
      const article = result.articles[i];
      output += `## ${i + 1}. ${article.authors} (${article.year})\n\n`;
      output += `**${article.title}**\n\n`;
      output += `*${article.journal}* | PMID: [${article.pmid}](${article.url})\n\n`;
      
      if (article.abstract) {
        output += `> ${article.abstract.slice(0, 300)}...\n\n`;
      }
      
      output += `Study types: ${article.publicationTypes.join(', ')}\n\n`;
    }
    
    return output;
  }
  
  /**
   * Format search results as CSV
   */
  formatAsCsv(result: SearchResult): string {
    const headers = ['pmid', 'title', 'authors', 'journal', 'year', 'url'];
    const rows = result.articles.map(a => [
      a.pmid,
      `"${a.title.replace(/"/g, '""')}"`,
      `"${a.authors}"`,
      `"${a.journal}"`,
      a.year,
      a.url,
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export default PubMedTools;
