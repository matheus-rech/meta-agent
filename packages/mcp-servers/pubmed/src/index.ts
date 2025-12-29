#!/usr/bin/env node
/**
 * PubMed MCP Server
 * Provides tools for searching and retrieving PubMed articles
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Neurosurgery domain knowledge
const NEUROSURGERY_MESH = {
  vascular: [
    '"Intracranial Aneurysm"[MeSH]',
    '"Arteriovenous Malformations"[MeSH]',
    '"Stroke"[MeSH]',
    '"Subarachnoid Hemorrhage"[MeSH]',
    '"Decompressive Craniectomy"[MeSH]',
  ],
  oncology: [
    '"Brain Neoplasms"[MeSH]',
    '"Glioma"[MeSH]',
    '"Glioblastoma"[MeSH]',
    '"Meningioma"[MeSH]',
    '"Pituitary Neoplasms"[MeSH]',
  ],
  spine: [
    '"Spinal Diseases"[MeSH]',
    '"Spinal Fusion"[MeSH]',
    '"Intervertebral Disc Degeneration"[MeSH]',
    '"Spinal Stenosis"[MeSH]',
    '"Spondylolisthesis"[MeSH]',
  ],
  functional: [
    '"Deep Brain Stimulation"[MeSH]',
    '"Epilepsy Surgery"[MeSH]',
    '"Movement Disorders"[MeSH]',
    '"Parkinson Disease"[MeSH]',
  ],
  pediatric: [
    '"Hydrocephalus"[MeSH]',
    '"Arnold-Chiari Malformation"[MeSH]',
    '"Craniosynostoses"[MeSH]',
    '"Myelomeningocele"[MeSH]',
  ],
  trauma: [
    '"Craniocerebral Trauma"[MeSH]',
    '"Brain Injuries, Traumatic"[MeSH]',
    '"Spinal Cord Injuries"[MeSH]',
    '"Intracranial Pressure"[MeSH]',
  ],
};

const STUDY_TYPE_FILTERS = {
  rct: 'randomized controlled trial[pt]',
  meta: 'meta-analysis[pt]',
  sr: 'systematic review[pt]',
  cohort: 'cohort studies[MeSH]',
  casecontrol: 'case-control studies[MeSH]',
};

// Define tools
const tools: Tool[] = [
  {
    name: 'search_pubmed',
    description: 'Search PubMed for neurosurgical literature with domain-aware query building',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (free text or structured)',
        },
        subspecialty: {
          type: 'string',
          enum: ['vascular', 'oncology', 'spine', 'functional', 'pediatric', 'trauma'],
          description: 'Neurosurgery subspecialty for MeSH expansion',
        },
        intervention: {
          type: 'string',
          description: 'Intervention or procedure to search for',
        },
        outcome: {
          type: 'string',
          description: 'Outcome of interest',
        },
        studyType: {
          type: 'string',
          enum: ['rct', 'meta', 'sr', 'cohort', 'casecontrol', 'all'],
          description: 'Filter by study type',
        },
        years: {
          type: 'number',
          description: 'Limit to last N years',
          default: 10,
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results',
          default: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_article',
    description: 'Get full details for a PubMed article by PMID',
    inputSchema: {
      type: 'object',
      properties: {
        pmid: {
          type: 'string',
          description: 'PubMed ID',
        },
      },
      required: ['pmid'],
    },
  },
  {
    name: 'get_citations',
    description: 'Get articles that cite a given PMID',
    inputSchema: {
      type: 'object',
      properties: {
        pmid: {
          type: 'string',
          description: 'PubMed ID to find citations for',
        },
        maxResults: {
          type: 'number',
          default: 20,
        },
      },
      required: ['pmid'],
    },
  },
  {
    name: 'get_related',
    description: 'Get related articles for a PMID',
    inputSchema: {
      type: 'object',
      properties: {
        pmid: {
          type: 'string',
          description: 'PubMed ID to find related articles for',
        },
        maxResults: {
          type: 'number',
          default: 10,
        },
      },
      required: ['pmid'],
    },
  },
  {
    name: 'build_search_strategy',
    description: 'Build a comprehensive search strategy from PICO elements',
    inputSchema: {
      type: 'object',
      properties: {
        population: {
          type: 'string',
          description: 'Patient population',
        },
        intervention: {
          type: 'string',
          description: 'Intervention',
        },
        comparator: {
          type: 'string',
          description: 'Comparator (optional)',
        },
        outcome: {
          type: 'string',
          description: 'Outcome',
        },
      },
      required: ['population', 'intervention'],
    },
  },
];

// PubMed API functions
const ENTREZ_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const EMAIL = process.env.PUBMED_EMAIL || 'research@example.com';
const API_KEY = process.env.NCBI_API_KEY || '';

async function searchPubMed(params: {
  query: string;
  subspecialty?: string;
  intervention?: string;
  outcome?: string;
  studyType?: string;
  years?: number;
  maxResults?: number;
}): Promise<any> {
  const {
    query,
    subspecialty,
    intervention,
    outcome,
    studyType = 'all',
    years = 10,
    maxResults = 20,
  } = params;
  
  // Build query
  let searchQuery = query;
  
  // Add subspecialty MeSH terms
  if (subspecialty && NEUROSURGERY_MESH[subspecialty as keyof typeof NEUROSURGERY_MESH]) {
    const meshTerms = NEUROSURGERY_MESH[subspecialty as keyof typeof NEUROSURGERY_MESH];
    searchQuery = `(${meshTerms.join(' OR ')}) AND (${searchQuery})`;
  }
  
  // Add intervention
  if (intervention) {
    searchQuery += ` AND ("${intervention}"[MeSH] OR "${intervention}"[Title/Abstract])`;
  }
  
  // Add outcome
  if (outcome) {
    searchQuery += ` AND ("${outcome}"[Title/Abstract])`;
  }
  
  // Add study type filter
  if (studyType !== 'all' && STUDY_TYPE_FILTERS[studyType as keyof typeof STUDY_TYPE_FILTERS]) {
    searchQuery += ` AND ${STUDY_TYPE_FILTERS[studyType as keyof typeof STUDY_TYPE_FILTERS]}`;
  }
  
  // Add date filter
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - years;
  searchQuery += ` AND ("${startYear}"[PDAT]:"${currentYear}"[PDAT])`;
  
  // Add standard filters
  searchQuery += ' AND humans[MeSH] AND english[Language]';
  
  // Execute search
  const searchUrl = new URL(`${ENTREZ_BASE}/esearch.fcgi`);
  searchUrl.searchParams.set('db', 'pubmed');
  searchUrl.searchParams.set('term', searchQuery);
  searchUrl.searchParams.set('retmax', String(maxResults));
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('email', EMAIL);
  if (API_KEY) searchUrl.searchParams.set('api_key', API_KEY);
  
  const searchResponse = await fetch(searchUrl.toString());
  const searchData = await searchResponse.json();
  
  const pmids = searchData.esearchresult?.idlist || [];
  const total = parseInt(searchData.esearchresult?.count || '0');
  
  if (pmids.length === 0) {
    return { total: 0, articles: [], query: searchQuery };
  }
  
  // Fetch article details
  const fetchUrl = new URL(`${ENTREZ_BASE}/efetch.fcgi`);
  fetchUrl.searchParams.set('db', 'pubmed');
  fetchUrl.searchParams.set('id', pmids.join(','));
  fetchUrl.searchParams.set('rettype', 'xml');
  fetchUrl.searchParams.set('retmode', 'xml');
  fetchUrl.searchParams.set('email', EMAIL);
  if (API_KEY) fetchUrl.searchParams.set('api_key', API_KEY);
  
  const fetchResponse = await fetch(fetchUrl.toString());
  const xmlText = await fetchResponse.text();
  
  // Parse XML (simplified - in production use proper XML parser)
  const articles = parseArticlesFromXML(xmlText);
  
  return {
    total,
    query: searchQuery,
    articles,
  };
}

async function getArticle(pmid: string): Promise<any> {
  const fetchUrl = new URL(`${ENTREZ_BASE}/efetch.fcgi`);
  fetchUrl.searchParams.set('db', 'pubmed');
  fetchUrl.searchParams.set('id', pmid);
  fetchUrl.searchParams.set('rettype', 'xml');
  fetchUrl.searchParams.set('retmode', 'xml');
  fetchUrl.searchParams.set('email', EMAIL);
  if (API_KEY) fetchUrl.searchParams.set('api_key', API_KEY);
  
  const response = await fetch(fetchUrl.toString());
  const xmlText = await response.text();
  
  const articles = parseArticlesFromXML(xmlText);
  return articles[0] || null;
}

async function getCitations(pmid: string, maxResults: number = 20): Promise<any> {
  const linkUrl = new URL(`${ENTREZ_BASE}/elink.fcgi`);
  linkUrl.searchParams.set('dbfrom', 'pubmed');
  linkUrl.searchParams.set('db', 'pubmed');
  linkUrl.searchParams.set('id', pmid);
  linkUrl.searchParams.set('linkname', 'pubmed_pubmed_citedin');
  linkUrl.searchParams.set('retmode', 'json');
  linkUrl.searchParams.set('email', EMAIL);
  if (API_KEY) linkUrl.searchParams.set('api_key', API_KEY);
  
  const response = await fetch(linkUrl.toString());
  const data = await response.json();
  
  const citingPmids = data.linksets?.[0]?.linksetdbs?.[0]?.links?.slice(0, maxResults) || [];
  
  if (citingPmids.length === 0) {
    return { total: 0, articles: [] };
  }
  
  // Fetch article details
  const fetchUrl = new URL(`${ENTREZ_BASE}/efetch.fcgi`);
  fetchUrl.searchParams.set('db', 'pubmed');
  fetchUrl.searchParams.set('id', citingPmids.join(','));
  fetchUrl.searchParams.set('rettype', 'xml');
  fetchUrl.searchParams.set('retmode', 'xml');
  fetchUrl.searchParams.set('email', EMAIL);
  
  const fetchResponse = await fetch(fetchUrl.toString());
  const xmlText = await fetchResponse.text();
  
  return {
    total: citingPmids.length,
    articles: parseArticlesFromXML(xmlText),
  };
}

async function getRelated(pmid: string, maxResults: number = 10): Promise<any> {
  const linkUrl = new URL(`${ENTREZ_BASE}/elink.fcgi`);
  linkUrl.searchParams.set('dbfrom', 'pubmed');
  linkUrl.searchParams.set('db', 'pubmed');
  linkUrl.searchParams.set('id', pmid);
  linkUrl.searchParams.set('linkname', 'pubmed_pubmed');
  linkUrl.searchParams.set('retmode', 'json');
  linkUrl.searchParams.set('email', EMAIL);
  if (API_KEY) linkUrl.searchParams.set('api_key', API_KEY);
  
  const response = await fetch(linkUrl.toString());
  const data = await response.json();
  
  const relatedPmids = data.linksets?.[0]?.linksetdbs?.[0]?.links?.slice(0, maxResults) || [];
  
  if (relatedPmids.length === 0) {
    return { total: 0, articles: [] };
  }
  
  const fetchUrl = new URL(`${ENTREZ_BASE}/efetch.fcgi`);
  fetchUrl.searchParams.set('db', 'pubmed');
  fetchUrl.searchParams.set('id', relatedPmids.join(','));
  fetchUrl.searchParams.set('rettype', 'xml');
  fetchUrl.searchParams.set('retmode', 'xml');
  fetchUrl.searchParams.set('email', EMAIL);
  
  const fetchResponse = await fetch(fetchUrl.toString());
  const xmlText = await fetchResponse.text();
  
  return {
    total: relatedPmids.length,
    articles: parseArticlesFromXML(xmlText),
  };
}

function buildSearchStrategy(pico: {
  population: string;
  intervention: string;
  comparator?: string;
  outcome?: string;
}): any {
  const { population, intervention, comparator, outcome } = pico;
  
  // Build strategy for each database
  const pubmed = buildPubMedStrategy(pico);
  const embase = buildEmbaseStrategy(pico);
  const cochrane = buildCochraneStrategy(pico);
  
  return {
    pico,
    strategies: {
      pubmed,
      embase,
      cochrane,
    },
    notes: [
      'Remember to export results in a format compatible with reference managers',
      'Document the date of each search',
      'Consider searching grey literature (OpenGrey, ClinicalTrials.gov)',
    ],
  };
}

function buildPubMedStrategy(pico: any): string {
  const lines = [];
  
  lines.push('# PubMed Search Strategy');
  lines.push('');
  lines.push('## Population');
  lines.push(`#1 "${pico.population}"[MeSH Terms]`);
  lines.push(`#2 "${pico.population}"[Title/Abstract]`);
  lines.push('#3 #1 OR #2');
  lines.push('');
  lines.push('## Intervention');
  lines.push(`#4 "${pico.intervention}"[MeSH Terms]`);
  lines.push(`#5 "${pico.intervention}"[Title/Abstract]`);
  lines.push('#6 #4 OR #5');
  
  if (pico.comparator) {
    lines.push('');
    lines.push('## Comparator');
    lines.push(`#7 "${pico.comparator}"[MeSH Terms]`);
    lines.push(`#8 "${pico.comparator}"[Title/Abstract]`);
    lines.push('#9 #7 OR #8');
  }
  
  if (pico.outcome) {
    lines.push('');
    lines.push('## Outcome');
    lines.push(`#10 "${pico.outcome}"[Title/Abstract]`);
  }
  
  lines.push('');
  lines.push('## Combined');
  let combined = '#3 AND #6';
  if (pico.comparator) combined += ' AND #9';
  if (pico.outcome) combined += ' AND #10';
  lines.push(`#FINAL ${combined}`);
  lines.push('');
  lines.push('## Filters');
  lines.push('Humans[MeSH] AND English[Language]');
  
  return lines.join('\n');
}

function buildEmbaseStrategy(pico: any): string {
  const lines = [];
  
  lines.push('# Embase Search Strategy (Ovid)');
  lines.push('');
  lines.push(`1. exp ${pico.population}/`);
  lines.push(`2. "${pico.population}".ti,ab.`);
  lines.push('3. 1 or 2');
  lines.push(`4. exp ${pico.intervention}/`);
  lines.push(`5. "${pico.intervention}".ti,ab.`);
  lines.push('6. 4 or 5');
  lines.push('7. 3 and 6');
  lines.push('8. limit 7 to (human and english language)');
  
  return lines.join('\n');
}

function buildCochraneStrategy(pico: any): string {
  const lines = [];
  
  lines.push('# Cochrane CENTRAL Search Strategy');
  lines.push('');
  lines.push(`#1 MeSH descriptor: [${pico.population}] explode all trees`);
  lines.push(`#2 "${pico.population}":ti,ab,kw`);
  lines.push('#3 #1 OR #2');
  lines.push(`#4 MeSH descriptor: [${pico.intervention}] explode all trees`);
  lines.push(`#5 "${pico.intervention}":ti,ab,kw`);
  lines.push('#6 #4 OR #5');
  lines.push('#7 #3 AND #6');
  
  return lines.join('\n');
}

// Simplified XML parser (in production, use proper XML parsing)
function parseArticlesFromXML(xml: string): any[] {
  const articles: any[] = [];
  
  // Extract each PubmedArticle
  const articleMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  
  for (const articleXml of articleMatches) {
    try {
      const pmid = extractTag(articleXml, 'PMID');
      const title = extractTag(articleXml, 'ArticleTitle');
      const abstractText = extractTag(articleXml, 'AbstractText') || '';
      const journal = extractTag(articleXml, 'Title') || extractTag(articleXml, 'ISOAbbreviation');
      const year = extractTag(articleXml, 'Year') || extractTag(articleXml, 'MedlineDate')?.slice(0, 4);
      
      // Extract authors
      const authorMatches = articleXml.match(/<Author[\s\S]*?<\/Author>/g) || [];
      const authors: string[] = [];
      for (const authorXml of authorMatches.slice(0, 3)) {
        const lastName = extractTag(authorXml, 'LastName');
        if (lastName) authors.push(lastName);
      }
      const authorString = authors.length > 0 
        ? (authors.length > 1 ? `${authors[0]} et al.` : authors[0])
        : 'Unknown';
      
      // Extract publication types
      const pubTypeMatches = articleXml.match(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g) || [];
      const pubTypes = pubTypeMatches.map(m => m.replace(/<[^>]+>/g, ''));
      
      articles.push({
        pmid,
        title,
        authors: authorString,
        journal,
        year,
        abstract: abstractText.slice(0, 500),
        publicationTypes: pubTypes,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    } catch (e) {
      // Skip malformed articles
    }
  }
  
  return articles;
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`));
  return match ? match[1].trim() : null;
}

// Create and start server
const server = new Server(
  {
    name: 'pubmed-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result: any;
    
    switch (name) {
      case 'search_pubmed':
        result = await searchPubMed(args as any);
        break;
      case 'get_article':
        result = await getArticle(args.pmid as string);
        break;
      case 'get_citations':
        result = await getCitations(args.pmid as string, args.maxResults as number);
        break;
      case 'get_related':
        result = await getRelated(args.pmid as string, args.maxResults as number);
        break;
      case 'build_search_strategy':
        result = buildSearchStrategy(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PubMed MCP Server running on stdio');
}

main().catch(console.error);
